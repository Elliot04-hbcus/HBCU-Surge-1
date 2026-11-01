import { CONFERENCES, standingsUrl, fetchEspn, parseStandings, seasonYear, teamSummaryUrl, parseTeamRecord, OTHER_HBCU_CONFERENCES } from "../../shared/espn.ts";

const OTHER_HBCU_TEAM_INFO = {
  "2448": { name: "North Carolina A&T Aggies", abbreviation: "NCAT", logo: "https://a.espncdn.com/combiner/i?img=/i/teamlogos/ncaa/500/2448.png&w=100&h=100" },
  "2261": { name: "Hampton Pirates", abbreviation: "HAMP", logo: "https://a.espncdn.com/combiner/i?img=/i/teamlogos/ncaa/500/2261.png&w=100&h=100" },
  "2634": { name: "Tennessee State Tigers", abbreviation: "TNST", logo: "https://a.espncdn.com/combiner/i?img=/i/teamlogos/ncaa/500/2634.png&w=100&h=100" },
};

export default async function (req) {
  try {
    const body = await req.json().catch(() => ({}));
    const sport = body.sport === "basketball" ? "basketball" : "football";
    const results = await Promise.allSettled(
      CONFERENCES.map((c) => fetchEspn(standingsUrl(sport, c)).then((d) => parseStandings(d, c)))
    );
    const conferences = [];
    const teams = [];
    results.forEach((r) => {
      if (r.status === "fulfilled") {
        conferences.push(r.value.conference);
        teams.push(...r.value.teams);
      }
    });

    // Fetch records for non-SWAC/MEAC HBCU teams.
    const otherIds = Object.keys(OTHER_HBCU_CONFERENCES);
    const otherResults = await Promise.allSettled(
      otherIds.map((id) => fetchEspn(teamSummaryUrl(sport, id)))
    );
    otherResults.forEach((r, i) => {
      if (r.status !== "fulfilled") return;
      const id = otherIds[i];
      const info = OTHER_HBCU_TEAM_INFO[id];
      teams.push({
        id,
        name: info.name,
        abbreviation: info.abbreviation,
        logo: info.logo,
        conference: OTHER_HBCU_CONFERENCES[id],
        record: parseTeamRecord(r.value) || "—",
      });
    });

    return Response.json({ sport, season: seasonYear(sport), conferences, teams });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}