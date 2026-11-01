import {
  athleteSeasonStatsUrl,
  athleteUrl,
  fetchEspn,
  seasonYear,
  idFromRef,
  FB_STAT_MAP,
  BK_STAT_MAP,
  parsePlayerStats,
} from "../../shared/espn.ts";

// How many past seasons to look back (including the current one).
const MAX_SEASONS = 14;

export default async function (req) {
  try {
    const body = await req.json().catch(() => ({}));
    const sport = body.sport === "basketball" ? "basketball" : "football";
    const athleteId = String(body.athleteId || "");
    if (!athleteId) return Response.json({ error: "athleteId required" }, { status: 400 });

    const currentSeason = seasonYear(sport);
    const statMap = sport === "basketball" ? BK_STAT_MAP : FB_STAT_MAP;

    const seasons = [];
    for (let y = currentSeason; y >= currentSeason - (MAX_SEASONS - 1); y--) {
      seasons.push(y);
    }

    // Fetch statistics + athlete info (for team) for each season in parallel.
    // The athlete fetch is non-fatal — stats are the source of truth for whether
    // a season has data.
    const results = await Promise.allSettled(
      seasons.map(async (season) => {
        const stats = await fetchEspn(athleteSeasonStatsUrl(sport, athleteId, season));
        let athlete = null;
        try {
          athlete = await fetchEspn(athleteUrl(sport, athleteId, season));
        } catch (e) {
          /* athlete endpoint may 404 for older seasons — skip team */
        }
        return { stats, athlete, season };
      })
    );

    const teamRefs = new Map(); // teamId -> $ref (unique teams to resolve)
    const history = [];
    results.forEach((r) => {
      if (r.status !== "fulfilled" || !r.value) return;
      const { stats, athlete, season } = r.value;
      const parsed = parsePlayerStats(stats, statMap);
      const cats = (stats.splits && stats.splits.categories) || [];
      const gpCat = cats.find((c) => c.name === "general");
      const gpStat = gpCat && (gpCat.stats || []).find((s) => s.name === "gamesPlayed");
      const gamesPlayed = gpStat && gpStat.value != null ? Number(gpStat.value) : null;
      if (gamesPlayed == null || gamesPlayed === 0) return;
      const teamRef = athlete && athlete.team && athlete.team.$ref;
      const teamId = teamRef ? idFromRef(teamRef, "teams") : null;
      if (teamId && !teamRefs.has(teamId)) teamRefs.set(teamId, teamRef);
      history.push({ season, gamesPlayed, stats: parsed, teamId });
    });

    // Resolve unique teams in parallel.
    const teamMap = {};
    await Promise.all(
      Array.from(teamRefs.entries()).map(async ([id, ref]) => {
        try {
          const data = await fetchEspn(ref);
          teamMap[id] = {
            id,
            name: data.displayName,
            shortName: data.shortDisplayName,
            logo: data.logos && data.logos[0] && data.logos[0].href,
            color: data.color,
          };
        } catch (e) {
          /* skip unresolvable team */
        }
      })
    );

    // Attach team info to each season.
    history.forEach((h) => {
      h.team = h.teamId ? teamMap[h.teamId] || null : null;
    });

    // Most recent season first.
    history.sort((a, b) => b.season - a.season);

    return Response.json({ sport, athleteId, seasons: history });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}