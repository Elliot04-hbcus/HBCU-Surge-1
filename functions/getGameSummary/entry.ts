import { summaryUrl, fetchEspn } from "../../shared/espn.ts";
import { customGameSummary } from "../../shared/celebrationBowl.ts";

export default async function (req) {
  try {
    const body = await req.json().catch(() => ({}));
    const sport = body.sport === "basketball" ? "basketball" : "football";
    const eventId = String(body.eventId || "").trim();
    if (!eventId) return Response.json({ error: "Missing eventId" }, { status: 400 });

    // Custom games: championships + Celebration Bowl
    const custom = customGameSummary(eventId);
    if (custom) return Response.json(custom);

    const data = await fetchEspn(summaryUrl(sport, eventId));

    const header = data.header || {};
    const comp = (header.competitions || [])[0] || {};
    const competitors = (comp.competitors || []).map((c) => ({
      id: c.team && c.team.id,
      name: c.team && c.team.displayName,
      shortName: c.team && c.team.shortDisplayName,
      abbreviation: c.team && c.team.abbreviation,
      logo:
        (c.team && c.team.logo) ||
        (c.team && c.team.logos && c.team.logos[0] && c.team.logos[0].href),
      color: c.team && c.team.color,
      homeAway: c.homeAway,
      score: c.score,
      winner: c.winner,
      linescores: (c.linescores || []).map((l) => l.displayValue),
    }));
    const status =
      comp.status && comp.status.type
        ? {
            state: comp.status.type.state,
            detail: comp.status.type.detail,
            shortDetail: comp.status.type.shortDetail,
            completed: comp.status.type.completed,
            clock: comp.status.clock,
            period: comp.status.period,
          }
        : null;

    const boxscore = ((data.boxscore && data.boxscore.teams) || []).map((t) => ({
      id: t.team && t.team.id,
      name: t.team && t.team.displayName,
      logo: t.team && t.team.logo,
      homeAway: t.homeAway,
      statistics: (t.statistics || []).map((s) => ({
        name: s.name,
        label: s.label,
        value: s.displayValue,
      })),
    }));

    // Header competitors often omit logos; fall back to the boxscore team logo.
    const logoById = {};
    boxscore.forEach((t) => {
      if (t.id) logoById[t.id] = t.logo;
    });
    competitors.forEach((c) => {
      if (!c.logo && logoById[c.id]) c.logo = logoById[c.id];
    });

    const teamHomeAway = {};
    competitors.forEach((c) => {
      if (c.id) teamHomeAway[c.id] = c.homeAway;
    });
    const playerStats = ((data.boxscore && data.boxscore.players) || []).map((t) => ({
      teamId: t.team && t.team.id,
      homeAway: teamHomeAway[t.team && t.team.id] || null,
      categories: (t.statistics || [])
        .map((cat) => ({
          name: cat.name,
          label: cat.label || cat.name,
          labels: cat.labels || [],
          athletes: (cat.athletes || [])
            .filter((s) => s.athlete)
            .map((s) => ({
              id: s.athlete.id,
              name: s.athlete.displayName,
              headshot:
                s.athlete.headshot && s.athlete.headshot.href
                  ? s.athlete.headshot.href
                  : null,
              jersey: s.athlete.jersey || "",
              position: s.athlete.position || "",
              values: s.stats || [],
            })),
        }))
        .filter((cat) => cat.athletes.length > 0),
    }));

    const scoringPlays = (data.scoringPlays || []).map((p) => ({
      id: p.id,
      text: p.text,
      scoreValue: p.scoreValue,
      period: (p.period && (p.period.displayValue || p.period.number)) || "",
      homeScore: p.homeScore,
      awayScore: p.awayScore,
      teamId: p.team && p.team.id,
    }));

    const winProbability = (data.winprobability || []).map((w) => ({
      playId: w.playId,
      homeWinPercent:
        w.homeWinPercentage != null ? Math.round(w.homeWinPercentage * 1000) / 10 : null,
    }));

    let plays = [];
    if (sport === "football") {
      const drives = data.drives || {};
      const allDrives = [...(drives.previous || []), ...(drives.current ? [drives.current] : [])];
      allDrives.forEach((d) => {
        (d.plays || []).forEach((p) => {
          plays.push({
            id: p.id,
            text: p.text,
            period: (p.period && (p.period.displayValue || p.period.number)) || "",
            clock: (p.clock && p.clock.displayValue) || "",
            teamId: p.team && p.team.id,
            scoring: p.scoring,
          });
        });
      });
    } else {
      plays = (data.plays || []).map((p) => ({
        id: p.id,
        text: p.text,
        period: (p.period && (p.period.displayValue || p.period.number)) || "",
        clock: (p.clock && p.clock.displayValue) || "",
        teamId: p.team && p.team.id,
        scoring: p.scoring,
      }));
    }
    plays.reverse();

    let situation = null;
    if (sport === "football" && data.downDistanceText) {
      situation = { downDistanceText: data.downDistanceText, possession: data.possessionText || null };
    }

    return Response.json({
      sport,
      eventId,
      date: comp.date || null,
      status,
      competitors,
      venue: comp.venue
        ? { name: comp.venue.fullName, city: comp.venue.address && comp.venue.address.city }
        : null,
      broadcasts: (comp.broadcasts || []).flatMap((b) => b.names || []),
      boxscore,
      playerStats,
      scoringPlays,
      winProbability,
      plays,
      situation,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}