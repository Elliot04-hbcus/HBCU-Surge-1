import {
  CONFERENCES,
  standingsUrl,
  fetchEspn,
  parseStandings,
  seasonYear,
  teamStatsUrl,
  parseTeamStats,
  teamSummaryUrl,
  parseTeamRecord,
  OTHER_HBCU_TEAM_LIST,
} from "../../shared/espn.ts";

function formatVal(v) {
  if (v == null) return "—";
  if (Math.abs(v) >= 1000) return Math.round(v).toLocaleString();
  return Number.isInteger(v) ? String(v) : Number(v).toFixed(1);
}

export default async function (req) {
  try {
    const body = await req.json().catch(() => ({}));
    const sport = body.sport === "basketball" ? "basketball" : "football";
    const season = seasonYear(sport);

    const standingsResults = await Promise.allSettled(
      CONFERENCES.map((c) => fetchEspn(standingsUrl(sport, c)).then((d) => parseStandings(d, c)))
    );
    const teams = [];
    standingsResults.forEach((r) => {
      if (r.status === "fulfilled") teams.push(...r.value.teams);
    });

    // Add non-SWAC/MEAC HBCU teams with their current records.
    const otherResults = await Promise.allSettled(
      OTHER_HBCU_TEAM_LIST.map((t) => fetchEspn(teamSummaryUrl(sport, t.id)))
    );
    otherResults.forEach((r, i) => {
      if (r.status !== "fulfilled") return;
      const info = OTHER_HBCU_TEAM_LIST[i];
      const record = parseTeamRecord(r.value) || "—";
      const [wins, losses] = record.split("-").map(Number);
      teams.push({
        id: info.id,
        name: info.name,
        logo: info.logo,
        conference: info.conference,
        record,
        wins: wins || 0,
        losses: losses || 0,
        avgPointsFor: null,
        avgPointsAgainst: null,
      });
    });

    if (!teams.length) return Response.json({ sport, season, categories: [] });

    const rows = teams.map((t) => ({
      id: t.id,
      name: t.name,
      logo: t.logo,
      conference: t.conference,
      wins: t.wins,
      losses: t.losses,
      pointsPerGame: t.avgPointsFor,
      pointsAgainstPerGame: t.avgPointsAgainst,
      passingYards: null,
      rushingYards: null,
      totalYards: null,
      passingYardsPerGame: null,
      rushingYardsPerGame: null,
      gamesPlayed: null,
    }));

    if (sport === "football") {
      const statResults = await Promise.allSettled(
        teams.map((t) => fetchEspn(teamStatsUrl(sport, t.id, season)).then((d) => parseTeamStats(d, t)))
      );
      statResults.forEach((r, i) => {
        if (r.status !== "fulfilled" || !r.value) return;
        rows[i].passingYards = r.value.passingYards;
        rows[i].rushingYards = r.value.rushingYards;
        rows[i].totalYards = r.value.totalYards;
        if (r.value.pointsPerGame != null) rows[i].pointsPerGame = r.value.pointsPerGame;
        const gp = r.value.gamesPlayed != null ? r.value.gamesPlayed : (rows[i].wins || 0) + (rows[i].losses || 0);
        rows[i].gamesPlayed = gp || null;
        if (gp && rows[i].passingYards != null) rows[i].passingYardsPerGame = rows[i].passingYards / gp;
        if (gp && rows[i].rushingYards != null) rows[i].rushingYardsPerGame = rows[i].rushingYards / gp;
      });
    }

    const rankBy = (key, dir = "desc", fmt = formatVal) =>
      rows
        .filter((t) => t[key] != null)
        .slice()
        .sort((a, b) =>
          dir === "desc" ? (b[key] ?? 0) - (a[key] ?? 0) : (a[key] ?? 0) - (b[key] ?? 0)
        )
        .map((t, i) => ({
          rank: i + 1,
          team: {
            id: t.id,
            name: t.name,
            logo: t.logo,
            conference: t.conference,
            record: [t.wins, t.losses].filter((x) => x != null).join("-"),
          },
          value: t[key],
          displayValue: fmt(t[key]),
        }));

    const categories = [];
    if (sport === "football") {
      const formatPG = (v) => (v == null ? "—" : Number(v).toFixed(1));
      categories.push({ key: "passingYardsPerGame", label: "Passing Yards Per Game", leaders: rankBy("passingYardsPerGame", "desc", formatPG) });
      categories.push({ key: "rushingYardsPerGame", label: "Rushing Yards Per Game", leaders: rankBy("rushingYardsPerGame", "desc", formatPG) });
      categories.push({ key: "totalYards", label: "Total Yards", leaders: rankBy("totalYards") });
      categories.push({ key: "pointsPerGame", label: "Points Per Game", leaders: rankBy("pointsPerGame") });
    } else {
      categories.push({ key: "pointsPerGame", label: "Points Per Game", leaders: rankBy("pointsPerGame") });
      categories.push({
        key: "pointsAgainstPerGame",
        label: "Fewest Points Allowed",
        leaders: rankBy("pointsAgainstPerGame", "asc"),
      });
    }

    return Response.json({ sport, season, categories });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}