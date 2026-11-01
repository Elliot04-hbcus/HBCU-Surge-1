import { rosterUrl, fetchEspn } from "../../shared/espn.ts";

export default async function (req) {
  try {
    const body = await req.json().catch(() => ({}));
    const sport = body.sport === "basketball" ? "basketball" : "football";
    const teamId = String(body.teamId || "");
    if (!teamId) return Response.json({ error: "teamId required" }, { status: 400 });

    const data = await fetchEspn(rosterUrl(sport, teamId));

    let raw = [];
    if (Array.isArray(data.athletes)) {
      if (data.athletes.length && (Array.isArray(data.athletes[0].items) || Array.isArray(data.athletes[0].athletes))) {
        raw = data.athletes.flatMap((g) => g.items || g.athletes || []);
      } else {
        raw = data.athletes;
      }
    } else if (Array.isArray(data.groups)) {
      raw = data.groups.flatMap((g) => g.items || g.athletes || []);
    }

    const athletes = raw
      .filter((a) => a && (a.fullName || a.displayName || a.firstName))
      .map((a) => ({
        id: a.id,
        name: a.fullName || a.displayName || [a.firstName, a.lastName].filter(Boolean).join(" "),
        jersey: a.jersey,
        position: a.position && (a.position.abbreviation || a.position.displayName || a.position),
        height: a.displayHeight || a.height,
        year: a.experience ? a.experience.displayValue || a.experience.years : a.year,
        hometown:
          (a.birthPlace && (a.birthPlace.displayText || [a.birthPlace.city, a.birthPlace.state].filter(Boolean).join(", "))) ||
          a.hometown,
        headshot: a.headshot && a.headshot.href,
      }));

    return Response.json({ sport, teamId, athletes });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}