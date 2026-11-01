// Custom games: conference championships + Cricket Celebration Bowl — not in
// ESPN's regular conference scoreboard, so we inject them manually.

export const CELEBRATION_BOWL_ID = "celebration-bowl-2026";
export const CELEBRATION_BOWL_WEEK = 15;

export const SWAC_CHAMP_ID = "swac-championship-2026";
export const SWAC_CHAMP_WEEK = 14;


export function celebrationBowlGame() {
  return {
    id: CELEBRATION_BOWL_ID,
    date: "2026-12-12T17:00:00Z", // 12:00 PM ET (EST in December)
    name: "Cricket Celebration Bowl",
    shortName: "Celebration Bowl",
    status: {
      state: "pre",
      detail: "Sat, Dec 12, 12:00 PM ET",
      shortDetail: "Scheduled",
      completed: false,
      clock: null,
      period: null,
    },
    venue: { name: "Mercedes-Benz Stadium", city: "Atlanta", state: "GA" },
    conferenceCompetition: false,
    broadcasts: [],
    competitors: [
      {
        id: "tbd-swac",
        name: "SWAC Champion (TBD)",
        shortName: "SWAC (TBD)",
        abbreviation: "SWAC",
        logo: null,
        color: null,
        homeAway: "away",
        score: null,
        winner: false,
        record: null,
        linescores: [],
        conferenceId: null,
        conference: "SWAC",
      },
      {
        id: "tbd-meac",
        name: "MEAC Champion (TBD)",
        shortName: "MEAC (TBD)",
        abbreviation: "MEAC",
        logo: null,
        color: null,
        homeAway: "home",
        score: null,
        winner: false,
        record: null,
        linescores: [],
        conferenceId: null,
        conference: "MEAC",
      },
    ],
    week: CELEBRATION_BOWL_WEEK,
  };
}

export function swacChampionshipGame() {
  return {
    id: SWAC_CHAMP_ID,
    date: "2026-12-05T21:00:00Z", // 4:00 PM ET
    name: "SWAC Championship",
    shortName: "SWAC Champ",
    status: {
      state: "pre",
      detail: "Sat, Dec 5, 4:00 PM ET",
      shortDetail: "Scheduled",
      completed: false,
      clock: null,
      period: null,
    },
    venue: { name: "TBD", city: null, state: null },
    conferenceCompetition: true,
    broadcasts: [],
    competitors: [
      {
        id: "tbd-swac-east",
        name: "SWAC East Champion (TBD)",
        shortName: "SWAC East (TBD)",
        abbreviation: "SWAC-E",
        logo: null,
        color: null,
        homeAway: "away",
        score: null,
        winner: false,
        record: null,
        linescores: [],
        conferenceId: null,
        conference: "SWAC",
      },
      {
        id: "tbd-swac-west",
        name: "SWAC West Champion (TBD)",
        shortName: "SWAC West (TBD)",
        abbreviation: "SWAC-W",
        logo: null,
        color: null,
        homeAway: "home",
        score: null,
        winner: false,
        record: null,
        linescores: [],
        conferenceId: null,
        conference: "SWAC",
      },
    ],
    week: SWAC_CHAMP_WEEK,
  };
}

// All custom games, for the scoreboard to inject by week.
export function customGames(week) {
  const all = [swacChampionshipGame(), celebrationBowlGame()];
  return all.filter((g) => g.week === week);
}

// Full game-summary shape for the game detail page, by custom game id.
export function customGameSummary(eventId) {
  let g;
  if (eventId === CELEBRATION_BOWL_ID) g = celebrationBowlGame();
  else if (eventId === SWAC_CHAMP_ID) g = swacChampionshipGame();
  else return null;
  return {
    sport: "football",
    eventId: g.id,
    date: g.date,
    status: g.status,
    competitors: g.competitors,
    venue: g.venue,
    broadcasts: g.broadcasts,
    boxscore: [],
    playerStats: [],
    scoringPlays: [],
    winProbability: [],
    plays: [],
    situation: null,
  };
}