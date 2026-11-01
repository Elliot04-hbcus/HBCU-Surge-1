// Returns top HBCU player stat leaders across SWAC + MEAC + Other.
// Aggregates per-game stats from the site v2 game summary box scores (the Core
// API group-leaders endpoint is blocked from our backend IPs with 403).
import {
  CONFERENCES,
  standingsUrl,
  fetchEspn,
  parseStandings,
  seasonYear,
  aggregatePlayerStats,
  OTHER_HBCU_TEAM_LIST,
  FB_LEADER_CATEGORIES,
  BK_LEADER_CATEGORIES,
  fetchRostersForTeams,
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
    const season = body.season ? Number(body.season) : seasonYear(sport);
    const categories = sport === "basketball" ? BK_LEADER_CATEGORIES : FB_LEADER_CATEGORIES;

    // Build a team id -> { name, logo, conference } map from standings.
    const standingsResults = await Promise.allSettled(
      CONFERENCES.map((c) => fetchEspn(standingsUrl(sport, c)).then((d) => parseStandings(d, c)))
    );
    const teamMap = {};
    const teamIds = [];
    standingsResults.forEach((r, i) => {
      if (r.status !== "fulfilled") return;
      r.value.teams.forEach((t) => {
        teamMap[t.id] = { id: t.id, name: t.name, logo: t.logo, conference: t.conference };
        teamIds.push(t.id);
      });
    });

    // Add non-SWAC/MEAC HBCU teams.
    OTHER_HBCU_TEAM_LIST.forEach((t) => {
      teamMap[t.id] = { id: t.id, name: t.name, logo: t.logo, conference: t.conference };
      teamIds.push(t.id);
    });

    if (!teamIds.length) return Response.json({ sport, season, leaders: {} });

    // Aggregate player stats across all game summaries for all HBCU teams.
    const athletes = await aggregatePlayerStats(sport, teamIds, season);

    // Fetch rosters for all teams in parallel to get position info.
    const rosterMap = await fetchRostersForTeams(sport, teamIds);

    // Build leader lists per category (top 10).
    const leaders = {};
    for (const [bucketKey, { statKey, perGame }] of Object.entries(categories)) {
      const entries = Object.values(athletes)
        .map((a) => {
          const total = a.stats[statKey];
          if (total == null) return null;
          const value = perGame && a.gamesPlayed > 0 ? total / a.gamesPlayed : total;
          const team = teamMap[a.teamId] || { id: a.teamId, name: null, logo: null, conference: null };
          const rosterInfo = rosterMap[a.athleteId];
          return {
            athleteId: a.athleteId,
            name: (rosterInfo && rosterInfo.name) || a.name || "Unknown",
            headshot: (rosterInfo && rosterInfo.headshot) || a.headshot,
            position: (rosterInfo && rosterInfo.position) || null,
            team,
            value,
            displayValue: formatStat(value),
          };
        })
        .filter(Boolean)
        .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
        .slice(0, 10);

      leaders[bucketKey] = entries.map((e, i) => ({ rank: i + 1, ...e }));
    }

    return Response.json({ sport, season, leaders });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}