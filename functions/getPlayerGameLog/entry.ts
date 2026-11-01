// Returns a player's per-game stats for the current season by aggregating
// from the site v2 game summary box scores (the Core API is blocked from
// our backend IPs with 403). Also returns season totals for the career section.
import {
  CONFERENCES,
  standingsUrl,
  scheduleUrl,
  summaryUrl,
  rosterUrl,
  fetchEspn,
  parseStandings,
  normalizeScheduleGame,
  seasonYear,
  parseGameSummaryForAthlete,
  findAthleteInRoster,
} from "../../shared/espn.ts";

export default async function (req) {
  try {
    const body = await req.json().catch(() => ({}));
    const sport = body.sport === "basketball" ? "basketball" : "football";
    const athleteId = String(body.athleteId || "");
    const teamId = body.teamId ? String(body.teamId) : null;
    if (!athleteId) return Response.json({ error: "athleteId required" }, { status: 400 });
    if (!teamId) return Response.json({ error: "teamId required" }, { status: 400 });
    const season = seasonYear(sport);

    // Build team map from standings (for conference labels and team info).
    let teamMap = {};
    const standResults = await Promise.allSettled(
      CONFERENCES.map((c) => fetchEspn(standingsUrl(sport, c)).then((d) => parseStandings(d, c)))
    );
    standResults.forEach((r) => {
      if (r.status !== "fulfilled") return;
      r.value.teams.forEach((t) => { teamMap[t.id] = t; });
    });

    // Fetch the team schedule and build game metadata.
    const sched = await fetchEspn(scheduleUrl(sport, teamId, season)).catch(() => null);
    const events = (sched && sched.events) || [];
    const gameMeta = {};
    events.forEach((e) => {
      const g = normalizeScheduleGame(e, teamMap);
      if (!g) return;
      const opp = (g.competitors || []).find((c) => String(c.id) !== String(teamId));
      const me = (g.competitors || []).find((c) => String(c.id) === String(teamId));
      gameMeta[String(g.id)] = {
        date: g.date,
        opponent: opp ? { id: opp.id, name: opp.name, logo: opp.logo } : null,
        homeAway: me ? me.homeAway : null,
        week: g.week,
        completed: g.status && g.status.completed,
      };
    });

    // Fetch game summaries for completed games in parallel.
    const completedIds = Object.entries(gameMeta)
      .filter(([_, m]) => m.completed)
      .map(([id]) => id);
    const summaryResults = await Promise.allSettled(
      completedIds.map((id) => fetchEspn(summaryUrl(sport, id)).catch(() => null))
    );

    // Get athlete info (position, headshot, class, birthplace) from the roster.
    const roster = await fetchEspn(rosterUrl(sport, teamId)).catch(() => null);
    const athleteInfo = roster ? findAthleteInRoster(roster, athleteId) : null;
    const position = (athleteInfo && athleteInfo.position) || "";
    const classification = (athleteInfo && athleteInfo.classification) || "";
    const hometown = (athleteInfo && athleteInfo.hometown) || "";

    // Build the game log from game summary box scores.
    const games = [];
    const seasonTotals = {};
    summaryResults.forEach((r, i) => {
      if (r.status !== "fulfilled" || !r.value) return;
      const eventId = completedIds[i];
      const meta = gameMeta[eventId];
      if (!meta) return;
      const stats = parseGameSummaryForAthlete(r.value, athleteId, sport);
      const hasAny = Object.values(stats).some((v) => v != null);
      if (!hasAny) return;
      games.push({
        eventId,
        date: meta.date,
        opponent: meta.opponent,
        homeAway: meta.homeAway,
        week: meta.week,
        stats,
      });
      // Accumulate season totals.
      for (const [k, v] of Object.entries(stats)) {
        if (v != null) seasonTotals[k] = (seasonTotals[k] || 0) + v;
      }
    });

    // Chronological order, number them 1..N.
    games.sort((a, b) => (a.date || "").localeCompare(b.date || ""));
    games.forEach((g, i) => { g.game = i + 1; });

    // Build a single-season history entry for the career stats section.
    const teamInfo = teamMap[String(teamId)];
    const seasonHistory = games.length > 0
      ? [{
          season,
          gamesPlayed: games.length,
          stats: seasonTotals,
          teamId,
          team: teamInfo
            ? { id: teamId, name: teamInfo.name, shortName: teamInfo.abbreviation, logo: teamInfo.logo }
            : null,
        }]
      : [];

    return Response.json({
      sport,
      season,
      athleteId,
      position,
      classification,
      hometown,
      games,
      seasonHistory,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}