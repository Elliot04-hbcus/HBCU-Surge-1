import {
  scheduleUrl,
  standingsUrl,
  fetchEspn,
  normalizeScheduleGame,
  parseStandings,
  CONFERENCES,
} from "../../shared/espn.ts";

export default async function (req) {
  try {
    const body = await req.json().catch(() => ({}));
    const sport = body.sport === "basketball" ? "basketball" : "football";
    const teamId = String(body.teamId || "");
    if (!teamId) return Response.json({ error: "teamId required" }, { status: 400 });

    const now = new Date();
    const season =
      sport === "football"
        ? now.getFullYear()
        : now.getMonth() >= 9
        ? now.getFullYear() + 1
        : now.getFullYear();

    const data = await fetchEspn(scheduleUrl(sport, teamId, season));

    // Build a team id -> { conference } map from SWAC + MEAC standings so we can
    // label each opponent's conference (the schedule endpoint omits it).
    const teamMap = {};
    await Promise.allSettled(
      CONFERENCES.map(async (c) => {
        const d = await fetchEspn(standingsUrl(sport, c));
        parseStandings(d, c).teams.forEach((t) => {
          teamMap[t.id] = { name: t.name, conference: t.conference, confRecord: t.confRecord };
        });
      })
    );

    const games = (data.events || [])
      .map((e) => normalizeScheduleGame(e, teamMap))
      .filter(Boolean)
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    const team = data.team
      ? {
          name: data.team.displayName,
          logo: data.team.logo,
          record: data.team.recordSummary,
          confRecord: (teamMap[String(data.team.id)] && teamMap[String(data.team.id)].confRecord) || null,
        }
      : null;

    return Response.json({ sport, teamId, season, team, games });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}