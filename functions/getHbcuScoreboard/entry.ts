import { CONFERENCES, scoreboardUrl, fetchEspn, normalizeGame, normalizeScheduleGame, scheduleUrl, seasonYear } from "../../shared/espn.ts";
import { customGames } from "../../shared/celebrationBowl.ts";

// HBCU D1 teams outside SWAC/MEAC: NC A&T, Hampton, Tennessee State
const OTHER_HBCU_TEAM_IDS = ["2448", "2261", "2634"];
const OTHER_HBCU_TEAM_MAP = {
  "2448": { conference: "CAA" },
  "2261": { conference: "CAA" },
  "2634": { conference: "OVC" },
};

export default async function (req) {
  try {
    const body = await req.json().catch(() => ({}));
    const sport = body.sport === "basketball" ? "basketball" : "football";
    const season = seasonYear(sport);

    const results = await Promise.allSettled(
      CONFERENCES.map((c) => fetchEspn(scoreboardUrl(sport, c, body)))
    );

    const seen = new Set();
    const games = [];
    let week = null;
    for (const r of results) {
      if (r.status !== "fulfilled") continue;
      if (week == null && r.value.week) week = r.value.week.number;
      for (const ev of r.value.events || []) {
        const g = normalizeGame(ev);
        if (g && !seen.has(g.id)) {
          seen.add(g.id);
          games.push(g);
        }
      }
    }

    // Merge in schedules for other HBCU D1 teams (Hampton, NC A&T, Tennessee State)
    const requestedWeek = body.week ? Number(body.week) : week;
    const scheduleResults = await Promise.allSettled(
      OTHER_HBCU_TEAM_IDS.map((id) => fetchEspn(scheduleUrl(sport, id, season)))
    );
    const now = new Date();
    for (const r of scheduleResults) {
      if (r.status !== "fulfilled") continue;
      for (const ev of r.value.events || []) {
        if (sport === "football") {
          if (requestedWeek != null && ev.week?.number !== requestedWeek) continue;
        } else {
          const gameDateStr = (ev.competitions?.[0]?.date || "").slice(0, 10).replace(/-/g, "");
          if (body.date) {
            if (gameDateStr !== body.date) continue;
          } else {
            // Upcoming view: only future games
            if (new Date(ev.competitions?.[0]?.date || 0) < now) continue;
          }
        }
        const g = normalizeScheduleGame(ev, OTHER_HBCU_TEAM_MAP);
        if (g && !seen.has(g.id)) {
          seen.add(g.id);
          games.push(g);
        }
      }
    }

    // Inject custom games (championships + Celebration Bowl) for football.
    if (sport === "football") {
      for (const g of customGames(requestedWeek)) {
        if (!seen.has(g.id)) {
          seen.add(g.id);
          games.push(g);
        }
      }
    }

    games.sort((a, b) => new Date(a.date) - new Date(b.date));

    return Response.json({ sport, season, week, games });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}