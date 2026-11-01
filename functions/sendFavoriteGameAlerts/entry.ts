import { createClientFromRequest } from "npm:@base44/sdk@0.8.52";
import {
  scheduleUrl,
  fetchEspn,
  normalizeScheduleGame,
  seasonYear,
} from "../../shared/espn.ts";

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);

    // 1. Get all favorites (service role bypasses RLS)
    const favorites = await base44.asServiceRole.entities.FavoriteTeam.filter({});
    if (!favorites || favorites.length === 0) {
      return Response.json({ sent: 0, message: "No favorites found" });
    }

    // 2. Group by sport -> teamId -> Set<userId>
    const sportTeamUsers = {};
    const userIds = new Set();
    favorites.forEach((f) => {
      const sport = f.sport || "football";
      const teamId = String(f.team_id);
      if (!sportTeamUsers[sport]) sportTeamUsers[sport] = {};
      if (!sportTeamUsers[sport][teamId]) sportTeamUsers[sport][teamId] = new Set();
      sportTeamUsers[sport][teamId].add(f.created_by_id);
      userIds.add(f.created_by_id);
    });

    // 3. Get user emails
    const users = await base44.asServiceRole.entities.User.filter({
      id: { $in: [...userIds] },
    });
    const userMap = {};
    (users || []).forEach((u) => {
      userMap[u.id] = { email: u.email, name: u.full_name };
    });

    // 4. For each sport+teamId, fetch schedule and find games in next 24h
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const alerts = [];

    for (const [sport, teams] of Object.entries(sportTeamUsers)) {
      const season = seasonYear(sport);
      const teamIds = Object.keys(teams);

      const scheduleResults = await Promise.allSettled(
        teamIds.map(async (teamId) => {
          const data = await fetchEspn(scheduleUrl(sport, teamId, season));
          const games = (data.events || [])
            .map((e) => normalizeScheduleGame(e, {}))
            .filter(Boolean)
            .filter((g) => {
              const gameDate = new Date(g.date);
              return gameDate >= now && gameDate <= tomorrow && g.status?.state === "pre";
            });
          return { teamId, games };
        })
      );

      scheduleResults.forEach((r) => {
        if (r.status !== "fulfilled") return;
        const { teamId, games } = r.value;
        for (const game of games) {
          for (const userId of teams[teamId]) {
            const user = userMap[userId];
            if (!user || !user.email) continue;
            const team = game.competitors.find((c) => String(c.id) === teamId);
            alerts.push({
              userId,
              email: user.email,
              name: user.name,
              teamId,
              teamName: team?.name || "Your team",
              game,
              sport,
            });
          }
        }
      });
    }

    if (alerts.length === 0) {
      return Response.json({
        sent: 0,
        message: "No upcoming games for favorited teams in the next 24 hours",
      });
    }

    // 5. Send emails
    let sent = 0;
    for (const alert of alerts) {
      try {
        const gameDate = new Date(alert.game.date);
        const dateStr = gameDate.toLocaleDateString("en-US", {
          weekday: "long",
          month: "short",
          day: "numeric",
        });
        const timeStr = gameDate.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
        });

        const opponent = alert.game.competitors.find(
          (c) => String(c.id) !== String(alert.teamId)
        );
        const team = alert.game.competitors.find(
          (c) => String(c.id) === String(alert.teamId)
        );

        await base44.asServiceRole.integrations.Core.SendEmail({
          to: alert.email,
          template_name: "FavoriteGameAlert",
          variables: {
            first_name: alert.name || "Fan",
            team_name: team?.name || "Your team",
            opponent_name: opponent?.name || "TBD",
            game_date: dateStr,
            game_time: timeStr,
            venue: alert.game.venue?.name || "TBD",
            home_away: team?.homeAway === "home" ? "vs" : "@",
            game_url: `https://hbcu-score-pulse.base44.app/games/${alert.game.id}?sport=${alert.sport}`,
          },
        });
        sent++;
      } catch (e) {
        // skip individual send failures
      }
    }

    return Response.json({ sent, total: alerts.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}