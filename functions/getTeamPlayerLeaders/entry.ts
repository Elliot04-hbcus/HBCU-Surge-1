// Returns the top statistical leaders for a single HBCU team's current season.
// Aggregates per-game stats from the site v2 game summary box scores (the Core
// API team-leaders endpoint is blocked from our backend IPs with 403).
import {
  scheduleUrl,
  summaryUrl,
  rosterUrl,
  fetchEspn,
  parseGameSummaryForAllAthletes,
  parseRoster,
  seasonYear,
  FB_LEADER_CATEGORIES,
  BK_LEADER_CATEGORIES,
} from "../../shared/espn.ts";

function formatStat(value) {
  if (value == null) return "—";
  const n = Number(value);
  if (Number.isInteger(n)) return Math.abs(n) >= 1000 ? n.toLocaleString() : String(n);
  return n.toFixed(1);
}

export default async function (req) {
  try {
    const body = await req.json().catch(() => ({}));
    const sport = body.sport === "basketball" ? "basketball" : "football";
    const teamId = String(body.teamId || "");
    if (!teamId) return Response.json({ error: "teamId required" }, { status: 400 });

    const season = seasonYear(sport);
    const categories = sport === "basketball" ? BK_LEADER_CATEGORIES : FB_LEADER_CATEGORIES;

    // Fetch the team schedule to get completed game IDs.
    const sched = await fetchEspn(scheduleUrl(sport, teamId, season)).catch(() => null);
    const events = (sched && sched.events) || [];
    const completedIds = [];
    events.forEach((e) => {
      const comp = e.competitions && e.competitions[0];
      if (comp && comp.status && comp.status.type && comp.status.type.completed) {
        completedIds.push(String(e.id));
      }
    });

    // Fetch game summaries for all completed games in parallel.
    const summaryResults = await Promise.allSettled(
      completedIds.map((id) => fetchEspn(summaryUrl(sport, id)).catch(() => null))
    );

    // Aggregate stats per athlete across all game summaries.
    const athletes = {};
    for (const r of summaryResults) {
      if (r.status !== "fulfilled" || !r.value) continue;
      const gameAthletes = parseGameSummaryForAllAthletes(r.value, sport);
      for (const [id, info] of Object.entries(gameAthletes)) {
        // Only include athletes from this team (the box score includes both teams).
        if (info.teamId && String(info.teamId) !== String(teamId)) continue;
        if (!athletes[id]) {
          athletes[id] = {
            athleteId: id,
            name: info.name,
            headshot: info.headshot,
            stats: {},
            gamesPlayed: 0,
          };
        }
        const hasAny = Object.values(info.stats).some((v) => v != null);
        if (hasAny) athletes[id].gamesPlayed++;
        for (const [k, v] of Object.entries(info.stats)) {
          if (v != null) athletes[id].stats[k] = (athletes[id].stats[k] || 0) + v;
        }
      }
    }

    // Fetch the roster for position info.
    const roster = await fetchEspn(rosterUrl(sport, teamId)).catch(() => null);
    const rosterMap = roster ? parseRoster(roster) : {};

    // Build leader lists per category.
    const leaders = {};
    for (const [bucketKey, { statKey, perGame }] of Object.entries(categories)) {
      const entries = Object.values(athletes)
        .map((a) => {
          const total = a.stats[statKey];
          if (total == null) return null;
          const value = perGame && a.gamesPlayed > 0 ? total / a.gamesPlayed : total;
          const rosterInfo = rosterMap[a.athleteId];
          return {
            athleteId: a.athleteId,
            name: (rosterInfo && rosterInfo.name) || a.name || "Unknown",
            headshot: (rosterInfo && rosterInfo.headshot) || a.headshot,
            position: (rosterInfo && rosterInfo.position) || null,
            value,
            displayValue: formatStat(value),
          };
        })
        .filter(Boolean)
        .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
        .slice(0, 5);

      leaders[bucketKey] = entries.map((e, i) => ({ rank: i + 1, ...e }));
    }

    return Response.json({ sport, season, teamId, leaders });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}