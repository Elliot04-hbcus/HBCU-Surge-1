// ESPN hidden API config & helpers for HBCU Division I sports (SWAC + MEAC).
// No API key required. Server-side only — never import from frontend.

export const SPORTS = {
  football: {
    label: "Football",
    path: "football/college-football",
    groups: { SWAC: 31, MEAC: 24 },
    coreSport: "football",
    coreLeague: "college-football",
    // Core v2 group-leaders category name -> our bucket key
    leaderCategories: {
      passingYards: "passing",
      rushingYards: "rushing",
      receivingYards: "receiving",
      sacks: "sacks",
      interceptions: "interceptions",
      totalTackles: "tackles",
      kickoffYards: "kickoffReturnYards",
    },
  },
  basketball: {
    label: "Basketball",
    path: "basketball/mens-college-basketball",
    groups: { SWAC: 26, MEAC: 16 },
    coreSport: "basketball",
    coreLeague: "mens-college-basketball",
    leaderCategories: {
      pointsPerGame: "scoring",
      assistsPerGame: "assists",
      reboundsPerGame: "rebounds",
      stealsPerGame: "steals",
      blocksPerGame: "blocks",
    },
  },
};

export const CONFERENCES = ["SWAC", "MEAC"];

// Reverse map of ESPN group/conference ids -> conference short name (both sports).
const CONFERENCE_BY_ID = {
  31: "SWAC", // football
  24: "MEAC", // football
  26: "SWAC", // basketball
  16: "MEAC", // basketball
};

// HBCU D1 teams outside SWAC/MEAC and their conference labels.
export const OTHER_HBCU_CONFERENCES = {
  "2448": "CAA", // NC A&T
  "2261": "CAA", // Hampton
  "2634": "OVC", // Tennessee State
};

// Full team info for non-SWAC/MEAC HBCU teams (shared across functions).
export const OTHER_HBCU_TEAM_LIST = [
  { id: "2448", name: "North Carolina A&T Aggies", abbreviation: "NCAT", logo: "https://a.espncdn.com/combiner/i?img=/i/teamlogos/ncaa/500/2448.png&w=100&h=100", conference: "CAA" },
  { id: "2261", name: "Hampton Pirates", abbreviation: "HAMP", logo: "https://a.espncdn.com/combiner/i?img=/i/teamlogos/ncaa/500/2261.png&w=100&h=100", conference: "CAA" },
  { id: "2634", name: "Tennessee State Tigers", abbreviation: "TNST", logo: "https://a.espncdn.com/combiner/i?img=/i/teamlogos/ncaa/500/2634.png&w=100&h=100", conference: "OVC" },
];

export function conferenceNameById(id) {
  if (id == null) return null;
  return CONFERENCE_BY_ID[String(id)] || null;
}

// Conference label for a team, using the ESPN conferenceId when available
// and falling back to the static map for non-SWAC/MEAC HBCU teams.
export function conferenceForTeam(teamId, conferenceId) {
  return conferenceNameById(conferenceId) || (teamId != null && OTHER_HBCU_CONFERENCES[String(teamId)]) || null;
}

const BASE = "https://site.api.espn.com/apis/site/v2/sports";
const STANDINGS_BASE = "https://site.api.espn.com/apis/v2/sports";

export async function fetchEspn(url) {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(10000),
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "application/json",
    },
  });
  if (!res.ok) throw new Error(`ESPN API error: ${res.status}`);
  return res.json();
}

export function scoreboardUrl(sport, conference, params) {
  const cfg = SPORTS[sport];
  let url = `${BASE}/${cfg.path}/scoreboard?groups=${cfg.groups[conference]}&limit=300`;
  if (params) {
    if (sport === "football" && params.week != null) url += `&week=${params.week}`;
    if (sport !== "football" && params.date) url += `&dates=${params.date}`;
  }
  return url;
}

export function standingsUrl(sport, conference) {
  const cfg = SPORTS[sport];
  return `${STANDINGS_BASE}/${cfg.path}/standings?group=${cfg.groups[conference]}`;
}

export function rosterUrl(sport, teamId) {
  const cfg = SPORTS[sport];
  return `${BASE}/${cfg.path}/teams/${teamId}/roster`;
}

export function teamSummaryUrl(sport, teamId) {
  const cfg = SPORTS[sport];
  return `${BASE}/${cfg.path}/teams/${teamId}`;
}

// Extract the overall win-loss record (e.g. "1-5") from a team summary response.
export function parseTeamRecord(data) {
  const items = (data && data.team && data.team.record && data.team.record.items) || [];
  const total = items.find((i) => i.type === "total");
  return total ? total.summary : null;
}

export function scheduleUrl(sport, teamId, season) {
  const cfg = SPORTS[sport];
  return `${BASE}/${cfg.path}/teams/${teamId}/schedule?season=${season}`;
}

export function summaryUrl(sport, eventId) {
  const cfg = SPORTS[sport];
  return `${BASE}/${cfg.path}/summary?event=${eventId}`;
}

// Normalize a game from the team schedule endpoint (differs from scoreboard:
// team.logos is an array, score is an object, status may be absent).
export function normalizeScheduleGame(event, teamMap) {
  const comp = event.competitions && event.competitions[0];
  if (!comp) return null;
  const competitors = (comp.competitors || []).map((c) => {
    const team = c.team || {};
    const rec = (c.record || c.records || []).find((r) => r.type === "total") || {};
    const score = c.score;
    return {
      id: team.id,
      name: team.displayName,
      shortName: team.shortDisplayName,
      abbreviation: team.abbreviation,
      logo: team.logo || (team.logos && team.logos[0] && team.logos[0].href),
      homeAway: c.homeAway,
      score: score && score.displayValue != null ? score.displayValue : score,
      winner: c.winner,
      record: rec.displayValue || rec.summary,
      conferenceId: team.conferenceId,
      conference: conferenceForTeam(team.id, team.conferenceId),
    };
  });
  let status = null;
  if (comp.status && comp.status.type) {
    status = {
      state: comp.status.type.state,
      detail: comp.status.type.detail,
      shortDetail: comp.status.type.shortDetail,
      completed: comp.status.type.completed,
    };
  } else {
    const past = new Date(comp.date) < new Date();
    status = {
      state: past ? "post" : "pre",
      detail: past
        ? "Final"
        : new Date(comp.date).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }),
      shortDetail: past ? "Final" : "Scheduled",
      completed: past,
    };
  }
  return {
    id: event.id,
    date: comp.date,
    name: event.name,
    shortName: event.shortName,
    status,
    venue: comp.venue
      ? { name: comp.venue.fullName, city: comp.venue.address && comp.venue.address.city, state: comp.venue.address && comp.venue.address.state }
      : null,
    neutralSite: comp.neutralSite,
    competitors,
    week: event.week && event.week.number,
  };
}

export function normalizeGame(event) {
  const comp = event.competitions && event.competitions[0];
  if (!comp) return null;
  const competitors = (comp.competitors || []).map((c) => {
    const overall = (c.records || []).find((r) => r.type === "total") || {};
    return {
      id: c.team && c.team.id,
      name: c.team && c.team.displayName,
      shortName: c.team && c.team.shortDisplayName,
      abbreviation: c.team && c.team.abbreviation,
      logo: c.team && c.team.logo,
      color: c.team && c.team.color,
      homeAway: c.homeAway,
      score: c.score,
      winner: c.winner,
      record: overall.summary,
      linescores: (c.linescores || []).map((l) => l.displayValue),
      conferenceId: c.team && c.team.conferenceId,
      conference: conferenceForTeam(c.team && c.team.id, c.team && c.team.conferenceId),
    };
  });
  const broadcasts = (comp.broadcasts || []).flatMap((b) => b.names || []).filter((n) => !/espn/i.test(n));
  return {
    id: event.id,
    date: comp.date,
    name: event.name,
    shortName: event.shortName,
    status: {
      state: comp.status && comp.status.type && comp.status.type.state,
      detail: comp.status && comp.status.type && comp.status.type.detail,
      shortDetail: comp.status && comp.status.type && comp.status.type.shortDetail,
      completed: comp.status && comp.status.type && comp.status.type.completed,
      clock: comp.status && comp.status.clock,
      period: comp.status && comp.status.period,
    },
    venue: comp.venue
      ? { name: comp.venue.fullName, city: comp.venue.address && comp.venue.address.city, state: comp.venue.address && comp.venue.address.state }
      : null,
    conferenceCompetition: comp.conferenceCompetition,
    broadcasts,
    competitors,
    week: event.week && event.week.number,
  };
}

// Parse a standings response into a flat team list + grouped standings.
// Football returns children (divisions); basketball returns entries directly.
export function parseStandings(data, conferenceName) {
  const teams = [];
  const groups = [];
  if (data.children && data.children.length) {
    for (const child of data.children) {
      const entries = (child.standings && child.standings.entries) || [];
      const parsed = entries.map((e) => normalizeEntry(e, conferenceName, child.shortName));
      groups.push({ name: child.name, shortName: child.shortName, entries: parsed });
      teams.push(...parsed);
    }
  } else {
    const entries = (data.standings && data.standings.entries) || [];
    const parsed = entries.map((e) => normalizeEntry(e, conferenceName, null));
    // Basketball standings return worst-to-best; rank best-to-worst by conference record, then overall win %.
    const confPct = (e) => {
      const m = (e.confRecord || "").match(/^(\d+)-(\d+)/);
      const w = m ? +m[1] : 0, l = m ? +m[2] : 0;
      return w + l > 0 ? w / (w + l) : 0;
    };
    parsed.sort((a, b) => {
      const diff = confPct(b) - confPct(a);
      if (diff) return diff;
      const aPct = a.wins + a.losses > 0 ? a.wins / (a.wins + a.losses) : 0;
      const bPct = b.wins + b.losses > 0 ? b.wins / (b.wins + b.losses) : 0;
      return bPct - aPct;
    });
    groups.push({ name: data.name, shortName: data.shortName, entries: parsed });
    teams.push(...parsed);
  }
  return { conference: { name: data.name, shortName: data.shortName, groups }, teams };
}

function normalizeEntry(entry, conferenceName, division) {
  const t = entry.team || {};
  const stats = entry.stats || [];
  const get = (type) => (stats.find((s) => s.type === type) || {}).displayValue;
  const getVal = (type) => (stats.find((s) => s.type === type) || {}).value;
  const overall = (stats.find((s) => s.type === "total") || {}).summary || "";
  const parts = overall.split("-");
  const wins = getVal("wins") != null ? getVal("wins") : (parts[0] ? Number(parts[0]) : undefined);
  const losses = getVal("losses") != null ? getVal("losses") : (parts[1] ? Number(parts[1]) : undefined);
  return {
    id: t.id,
    name: t.displayName,
    location: t.location,
    mascot: t.name,
    abbreviation: t.abbreviation,
    logo: t.logos && t.logos[0] && t.logos[0].href,
    conference: conferenceName,
    division,
    record: overall,
    confRecord: get("vsconf"),
    wins,
    losses,
    pointsFor: getVal("pointsfor"),
    pointsAgainst: getVal("pointsagainst"),
    avgPointsFor: getVal("avgpointsfor"),
    avgPointsAgainst: getVal("avgpointsagainst"),
    streak: get("streak"),
    winPercent: get("winpercent") || get("leaguewinpercent"),
    gamesBehind: get("gamesbehind"),
  };
}

const CORE_BASE = "https://sports.core.api.espn.com/v2/sports";

// ESPN season param for the current moment.
// Football: the season played in the fall = current year (Aug-Dec), else prior year.
// Basketball: param is the year the season ends; off-season shows the last completed season.
export function seasonYear(sport) {
  const now = new Date();
  const year = now.getUTCFullYear();
  const m = now.getUTCMonth() + 1;
  if (sport === "football") return m >= 8 ? year : year - 1;
  return m >= 11 ? year + 1 : year;
}

export function teamLeadersUrl(sport, teamId, season) {
  const cfg = SPORTS[sport];
  return `${CORE_BASE}/${cfg.coreSport}/leagues/${cfg.coreLeague}/seasons/${season}/types/2/teams/${teamId}/leaders`;
}

export function groupLeadersUrl(sport, conference, season) {
  const cfg = SPORTS[sport];
  return `${CORE_BASE}/${cfg.coreSport}/leagues/${cfg.coreLeague}/seasons/${season}/types/2/groups/${cfg.groups[conference]}/leaders`;
}

export function athleteUrl(sport, athleteId, season) {
  const cfg = SPORTS[sport];
  return `${CORE_BASE}/${cfg.coreSport}/leagues/${cfg.coreLeague}/seasons/${season}/athletes/${athleteId}`;
}

// Per-game event log (stats per game) for an athlete in a given season.
export function athleteEventLogUrl(sport, athleteId, season) {
  const cfg = SPORTS[sport];
  return `${CORE_BASE}/${cfg.coreSport}/leagues/${cfg.coreLeague}/seasons/${season}/athletes/${athleteId}/eventlog`;
}

export function teamStatsUrl(sport, teamId, season) {
  const cfg = SPORTS[sport];
  return `${BASE}/${cfg.path}/teams/${teamId}/statistics?season=${season}`;
}

export function idFromRef(ref, type) {
  if (!ref) return null;
  const m = ref.match(new RegExp(`/${type}/(\\d+)`));
  return m ? m[1] : null;
}

// Parse a Core v2 team-leaders response into bucketed player entries.
export function parseTeamLeaders(data, team, sport) {
  const map = SPORTS[sport].leaderCategories;
  const out = {};
  (data.categories || []).forEach((c) => {
    const key = map[c.name];
    if (!key) return;
    if (!out[key]) out[key] = [];
    (c.leaders || []).forEach((l) => {
      const athleteId = idFromRef(l.athlete && l.athlete.$ref, "athletes");
      if (!athleteId) return;
      out[key].push({ athleteId, value: l.value, displayValue: l.displayValue, team });
    });
  });
  return out;
}

// Parse a Core v2 group-leaders response into bucketed player entries.
// `teamMap` maps team id -> { name, logo, conference } (from standings).
export function parseGroupLeaders(data, teamMap, sport) {
  const map = SPORTS[sport].leaderCategories;
  const out = {};
  (data.categories || []).forEach((c) => {
    const key = map[c.name];
    if (!key) return;
    if (!out[key]) out[key] = [];
    (c.leaders || []).forEach((l) => {
      const athleteId = idFromRef(l.athlete && l.athlete.$ref, "athletes");
      const teamId = idFromRef(l.team && l.team.$ref, "teams");
      if (!athleteId) return;
      out[key].push({
        athleteId,
        value: l.value,
        displayValue: l.displayValue,
        team: teamMap[teamId] || { id: teamId, name: null, logo: null, conference: null },
      });
    });
  });
  return out;
}

// Player stat key -> [category, statName] mapping (shared by game log & season history).
export const FB_STAT_MAP = {
  passingYards: ["passing", "passingYards"],
  passingTouchdowns: ["passing", "passingTouchdowns"],
  rushingYards: ["rushing", "rushingYards"],
  rushingTouchdowns: ["rushing", "rushingTouchdowns"],
  receivingYards: ["receiving", "receivingYards"],
  receptions: ["receiving", "receptions"],
  receivingTouchdowns: ["receiving", "receivingTouchdowns"],
  totalTackles: ["defensive", "totalTackles"],
  sacks: ["defensive", "sacks"],
  tacklesForLoss: ["defensive", "tacklesForLoss"],
  passesDefended: ["defensive", "passesDefended"],
  interceptions: ["defensiveInterceptions", "interceptions"],
  passingInterceptions: ["passing", "interceptions"],
};

export const BK_STAT_MAP = {
  points: ["offensive", "points"],
  rebounds: ["general", "rebounds"],
  assists: ["offensive", "assists"],
  steals: ["defensive", "steals"],
  blocks: ["defensive", "blocks"],
};

// Season-level totals for an athlete in a given season (type 2 = regular season).
export function athleteSeasonStatsUrl(sport, athleteId, season) {
  const cfg = SPORTS[sport];
  return `${CORE_BASE}/${cfg.coreSport}/leagues/${cfg.coreLeague}/seasons/${season}/types/2/athletes/${athleteId}/statistics`;
}

// Parse a Core v2 splits response (per-game or season-level) into a flat stat object.
export function parsePlayerStats(data, statMap) {
  const cats = (data && data.splits && data.splits.categories) || [];
  const find = (catName, statName) => {
    const cat = cats.find((c) => c.name === catName);
    if (!cat) return null;
    const s = (cat.stats || []).find((x) => x.name === statName);
    return s && s.value != null ? Number(s.value) : null;
  };
  const out = {};
  for (const [key, [catName, statName]] of Object.entries(statMap)) {
    out[key] = find(catName, statName);
  }
  return out;
}

// Parse a site v2 team-statistics response (football) into key team totals.
export function parseTeamStats(data, team) {
  const cats = (data.results && data.results.stats && data.results.stats.categories) || [];
  const find = (name) => {
    for (const c of cats) {
      const s = (c.stats || []).find((x) => x.name === name);
      if (s && s.value != null) return s.value;
    }
    return null;
  };
  return {
    team,
    passingYards: find("passingYards") != null ? find("passingYards") : find("netPassingYards"),
    rushingYards: find("rushingYards"),
    totalYards: find("totalYards"),
    pointsPerGame: find("totalPointsPerGame"),
    gamesPlayed: find("gamesPlayed"),
  };
}

// --- Game summary box score helpers (site v2 API) ---
// The Core API (sports.core.api.espn.com) returns 403 from backend function IPs,
// so we extract per-game player stats from the site v2 game summary box score.

function parseStatValue(val) {
  if (val == null || val === "" || val === "-") return null;
  const n = Number(val);
  return isNaN(n) ? null : n;
}

// Maps our stat keys to { category, key } in the game summary box score.
// Football: stats are spread across named categories (passing, rushing, etc.).
// Basketball: all stats are in a single unnamed category (name is undefined).
export const FB_BOXSCORE_STAT_MAP = {
  passingYards: { category: "passing", key: "passingYards" },
  passingTouchdowns: { category: "passing", key: "passingTouchdowns" },
  passingInterceptions: { category: "passing", key: "interceptions" },
  rushingYards: { category: "rushing", key: "rushingYards" },
  rushingTouchdowns: { category: "rushing", key: "rushingTouchdowns" },
  receivingYards: { category: "receiving", key: "receivingYards" },
  receptions: { category: "receiving", key: "receptions" },
  receivingTouchdowns: { category: "receiving", key: "receivingTouchdowns" },
  totalTackles: { category: "defensive", key: "totalTackles" },
  sacks: { category: "defensive", key: "sacks" },
  tacklesForLoss: { category: "defensive", key: "tacklesForLoss" },
  passesDefended: { category: "defensive", key: "passesDefended" },
  interceptions: { category: "interceptions", key: "interceptions" },
};

export const BK_BOXSCORE_STAT_MAP = {
  points: { category: null, key: "points" },
  rebounds: { category: null, key: "rebounds" },
  assists: { category: null, key: "assists" },
  steals: { category: null, key: "steals" },
  blocks: { category: null, key: "blocks" },
};

// Extract a single athlete's stats from a game summary box score.
export function parseGameSummaryForAthlete(data, athleteId, sport) {
  const statMap = sport === "basketball" ? BK_BOXSCORE_STAT_MAP : FB_BOXSCORE_STAT_MAP;
  const players = (data && data.boxscore && data.boxscore.players) || [];
  const stats = {};
  for (const teamEntry of players) {
    for (const cat of (teamEntry.statistics || [])) {
      const catName = cat.name;
      const keys = cat.keys || [];
      for (const a of (cat.athletes || [])) {
        const id = a.athlete && a.athlete.id;
        if (String(id) !== String(athleteId)) continue;
        for (const [ourKey, { category, key }] of Object.entries(statMap)) {
          if (category != null && catName !== category) continue;
          const idx = keys.indexOf(key);
          if (idx === -1) continue;
          const val = parseStatValue(a.stats[idx]);
          if (val != null) stats[ourKey] = val;
        }
      }
    }
  }
  return stats;
}

// Extract all athletes' stats from a game summary box score (for aggregation).
// Returns a map: athleteId -> { athleteId, teamId, name, headshot, stats: { ourKey: value } }
export function parseGameSummaryForAllAthletes(data, sport) {
  const statMap = sport === "basketball" ? BK_BOXSCORE_STAT_MAP : FB_BOXSCORE_STAT_MAP;
  const players = (data && data.boxscore && data.boxscore.players) || [];
  const result = {};
  for (const teamEntry of players) {
    const teamId = teamEntry.team && teamEntry.team.id;
    for (const cat of (teamEntry.statistics || [])) {
      const catName = cat.name;
      const keys = cat.keys || [];
      for (const a of (cat.athletes || [])) {
        const athleteId = a.athlete && a.athlete.id;
        if (!athleteId) continue;
        const idStr = String(athleteId);
        if (!result[idStr]) {
          result[idStr] = {
            athleteId: idStr,
            teamId: teamId != null ? String(teamId) : null,
            name: a.athlete.displayName,
            headshot: a.athlete.headshot && a.athlete.headshot.href,
            stats: {},
          };
        }
        for (const [ourKey, { category, key }] of Object.entries(statMap)) {
          if (category != null && catName !== category) continue;
          const idx = keys.indexOf(key);
          if (idx === -1) continue;
          const val = parseStatValue(a.stats[idx]);
          if (val != null) result[idStr].stats[ourKey] = val;
        }
      }
    }
  }
  return result;
}

// Find a single athlete in a roster response (site v2).
export function findAthleteInRoster(data, athleteId) {
  const groups = (data && data.athletes) || [];
  for (const group of groups) {
    for (const item of (group.items || [])) {
      if (String(item.id) === String(athleteId)) {
        return {
          name: item.fullName || item.displayName || [item.firstName, item.lastName].filter(Boolean).join(" "),
          headshot: item.headshot && item.headshot.href,
          position: item.position && (item.position.abbreviation || item.position.displayName),
          classification: item.experience && (item.experience.abbreviation || item.experience.displayValue),
          hometown: item.birthPlace ? [item.birthPlace.city, item.birthPlace.state].filter(Boolean).join(", ") : "",
          jersey: item.jersey,
        };
      }
    }
  }
  return null;
}

// Fetch rosters for multiple teams and return a combined athlete lookup map.
// Returns: athleteId -> { name, headshot, position, classification }
export async function fetchRostersForTeams(sport, teamIds) {
  const results = await Promise.allSettled(
    teamIds.map((id) => fetchEspn(rosterUrl(sport, id)).catch(() => null))
  );
  const map = {};
  results.forEach((r) => {
    if (r.status !== "fulfilled" || !r.value) return;
    const rosterMap = parseRoster(r.value);
    for (const [id, info] of Object.entries(rosterMap)) {
      map[id] = info;
    }
  });
  return map;
}

// Parse a full roster into a map: athleteId -> { name, headshot, position, classification }
export function parseRoster(data) {
  const groups = (data && data.athletes) || [];
  const result = {};
  for (const group of groups) {
    for (const item of (group.items || [])) {
      if (!item.id) continue;
      result[String(item.id)] = {
        name: item.fullName || item.displayName || [item.firstName, item.lastName].filter(Boolean).join(" "),
        headshot: item.headshot && item.headshot.href,
        position: item.position && (item.position.abbreviation || item.position.displayName),
        classification: item.experience && (item.experience.abbreviation || item.experience.displayValue),
      };
    }
  }
  return result;
}

// Leader category definitions: bucket key -> { statKey, perGame? }
export const FB_LEADER_CATEGORIES = {
  passing: { statKey: "passingYards" },
  rushing: { statKey: "rushingYards" },
  receiving: { statKey: "receivingYards" },
  sacks: { statKey: "sacks" },
  interceptions: { statKey: "interceptions" },
  tackles: { statKey: "totalTackles" },
};

export const BK_LEADER_CATEGORIES = {
  scoring: { statKey: "points", perGame: true },
  assists: { statKey: "assists", perGame: true },
  rebounds: { statKey: "rebounds", perGame: true },
  steals: { statKey: "steals", perGame: true },
  blocks: { statKey: "blocks", perGame: true },
};

// Aggregate player stats across all game summaries for a set of teams.
// Fetches schedules, deduplicates games, fetches summaries in batches, and aggregates.
// Returns a map: athleteId -> { athleteId, teamId, name, headshot, stats: { ourKey: total }, gamesPlayed }
export async function aggregatePlayerStats(sport, teamIds, season) {
  // 1. Fetch all team schedules and collect completed game IDs.
  const scheduleResults = await Promise.allSettled(
    teamIds.map((id) => fetchEspn(scheduleUrl(sport, id, season)))
  );
  const gameIdSet = new Set();
  scheduleResults.forEach((r) => {
    if (r.status !== "fulfilled" || !r.value) return;
    const events = r.value.events || [];
    events.forEach((e) => {
      const comp = e.competitions && e.competitions[0];
      if (!comp || !comp.status || !comp.status.type || !comp.status.type.completed) return;
      gameIdSet.add(String(e.id));
    });
  });

  // 2. Fetch all unique game summaries in batches to avoid overwhelming the server.
  const gameIds = [...gameIdSet];
  const summaries = [];
  const BATCH = 25;
  for (let i = 0; i < gameIds.length; i += BATCH) {
    const batch = gameIds.slice(i, i + BATCH);
    const results = await Promise.allSettled(
      batch.map((id) => fetchEspn(summaryUrl(sport, id)).catch(() => null))
    );
    results.forEach((r) => {
      if (r.status === "fulfilled" && r.value) summaries.push(r.value);
    });
  }

  // 3. Aggregate stats per athlete across all game summaries.
  const athletes = {};
  for (const summary of summaries) {
    const gameAthletes = parseGameSummaryForAllAthletes(summary, sport);
    for (const [id, info] of Object.entries(gameAthletes)) {
      if (!athletes[id]) {
        athletes[id] = {
          athleteId: id,
          teamId: info.teamId,
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

  return athletes;
}