// Returns the top 6 HBCU players across SWAC + MEAC + Other — one per stat category,
// filled with #2/#3 from priority categories when a player already appears.
// Aggregates per-game stats from the site v2 game summary box scores.
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

// Category priority order + display labels for the "Top 6" spotlight.
const CATEGORY_META = {
  football: [
    { key: "passing", label: "Pass YDS" },
    { key: "rushing", label: "Rush YDS" },
    { key: "receiving", label: "Rec YDS" },
    { key: "sacks", label: "Sacks" },
    { key: "interceptions", label: "INT" },
    { key: "tackles", label: "Tackles" },
  ],
  basketball: [
    { key: "scoring", label: "PPG" },
    { key: "assists", label: "APG" },
    { key: "rebounds", label: "RPG" },
    { key: "steals", label: "SPG" },
    { key: "blocks", label: "BPG" },
  ],
};

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
    const season = seasonYear(sport);
    const meta = CATEGORY_META[sport];
    const categories = sport === "basketball" ? BK_LEADER_CATEGORIES : FB_LEADER_CATEGORIES;

    // Build team map from standings.
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
    OTHER_HBCU_TEAM_LIST.forEach((t) => {
      teamMap[t.id] = { id: t.id, name: t.name, logo: t.logo, conference: t.conference };
      teamIds.push(t.id);
    });

    if (!teamIds.length) return Response.json({ sport, season, players: [] });

    // Aggregate player stats across all game summaries.
    const athletes = await aggregatePlayerStats(sport, teamIds, season);

    // Fetch rosters for all teams in parallel to get position + classification info.
    const rosterMap = await fetchRostersForTeams(sport, teamIds);

    // Build sorted buckets per category.
    const buckets = {};
    for (const [bucketKey, { statKey, perGame }] of Object.entries(categories)) {
      buckets[bucketKey] = Object.values(athletes)
        .map((a) => {
          const total = a.stats[statKey];
          if (total == null) return null;
          const value = perGame && a.gamesPlayed > 0 ? total / a.gamesPlayed : total;
          const team = teamMap[a.teamId] || { id: a.teamId, name: null, logo: null, conference: null };
          const rosterInfo = rosterMap[a.athleteId];
          return {
            athleteId: a.athleteId,
            name: (rosterInfo && rosterInfo.name) || a.name,
            headshot: (rosterInfo && rosterInfo.headshot) || a.headshot,
            position: (rosterInfo && rosterInfo.position) || null,
            class: (rosterInfo && rosterInfo.classification) || null,
            team, value, displayValue: formatStat(value),
          };
        })
        .filter(Boolean)
        .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
    }

    // Pick the #1 from each category (deduplicated). Fill to 6 with #2, #3, etc.
    const selected = [];
    const usedIds = new Set();
    let depth = 0;
    while (selected.length < 6 && depth < 10) {
      for (const cat of meta) {
        if (selected.length >= 6) break;
        const arr = buckets[cat.key] || [];
        const entry = arr[depth];
        if (!entry) continue;
        if (usedIds.has(entry.athleteId)) continue;
        usedIds.add(entry.athleteId);
        selected.push({ ...entry, statLabel: cat.label });
      }
      depth++;
    }

    const players = selected.map((e, i) => ({
      rank: i + 1,
      athleteId: e.athleteId,
      name: e.name || "Unknown",
      headshot: e.headshot,
      position: e.position || null,
      class: e.class || null,
      team: e.team,
      statLabel: e.statLabel,
      displayValue: e.displayValue,
    }));

    return Response.json({ sport, season, players });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}