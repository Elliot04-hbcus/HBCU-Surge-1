import React from "react";
import { useParams, useSearchParams, Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import TeamLogo from "@/components/TeamLogo";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

// Stat metadata per sport: label + chart color.
const FB_STATS = {
  passingYards: { label: "Passing Yards", color: "#9b1c2e" },
  passingTouchdowns: { label: "Passing TDs", color: "#9b1c2e" },
  rushingYards: { label: "Rushing Yards", color: "#caa017" },
  rushingTouchdowns: { label: "Rushing TDs", color: "#caa017" },
  receivingYards: { label: "Receiving Yards", color: "#1f6feb" },
  receptions: { label: "Receptions", color: "#1f6feb" },
  receivingTouchdowns: { label: "Receiving TDs", color: "#1f6feb" },
  totalTackles: { label: "Tackles", color: "#16a34a" },
  sacks: { label: "Sacks", color: "#16a34a" },
  tacklesForLoss: { label: "TFL", color: "#16a34a" },
  interceptions: { label: "Interceptions", color: "#16a34a" },
  passesDefended: { label: "Passes Defended", color: "#16a34a" },
  passingInterceptions: { label: "INT", color: "#9b1c2e" },
};

const BK_STATS = {
  points: { label: "Points", color: "#9b1c2e" },
  rebounds: { label: "Rebounds", color: "#caa017" },
  assists: { label: "Assists", color: "#1f6feb" },
  steals: { label: "Steals", color: "#16a34a" },
  blocks: { label: "Blocks", color: "#16a34a" },
};

// Position -> which stats to chart and tabulate (football).
const FB_PROFILES = {
  QB: { chart: ["passingYards", "rushingYards"], table: ["passingYards", "passingTouchdowns", "passingInterceptions", "rushingYards", "rushingTouchdowns"], totals: ["passingTouchdowns", "passingInterceptions", "rushingTouchdowns"] },
  RB: { chart: ["rushingYards", "receivingYards"], table: ["rushingYards", "rushingTouchdowns", "receivingYards", "receptions"], totals: ["rushingTouchdowns", "receptions", "receivingTouchdowns"] },
  FB: { chart: ["rushingYards", "receivingYards"], table: ["rushingYards", "receivingYards", "receptions"], totals: ["receptions", "rushingTouchdowns"] },
  WR: { chart: ["receivingYards"], table: ["receivingYards", "receptions", "receivingTouchdowns"], totals: ["receptions", "receivingTouchdowns"] },
  TE: { chart: ["receivingYards"], table: ["receivingYards", "receptions", "receivingTouchdowns"], totals: ["receptions", "receivingTouchdowns"] },
};
const FB_DEFENSE = ["DL", "DE", "DT", "NG", "EDGE", "LB", "ILB", "OLB", "MLB", "DB", "CB", "S", "SS", "FS", "NB"];
const FB_DEFENSE_PROFILE = { chart: ["totalTackles", "sacks"], table: ["totalTackles", "sacks", "tacklesForLoss", "interceptions", "passesDefended"], totals: ["tacklesForLoss", "interceptions", "passesDefended"] };
const BK_PROFILE = { chart: ["points", "rebounds", "assists"], table: ["points", "rebounds", "assists", "steals", "blocks"], totals: ["steals", "blocks"] };

function getProfile(sport, position, games) {
  if (sport === "basketball") return BK_PROFILE;
  const pos = (position || "").toUpperCase();
  if (FB_PROFILES[pos]) return FB_PROFILES[pos];
  if (FB_DEFENSE.includes(pos)) return FB_DEFENSE_PROFILE;
  // Unrecognized position: infer from whatever the player actually recorded.
  const has = (keys) => games.some((g) => keys.some((k) => g.stats[k] != null));
  if (has(["totalTackles", "sacks", "tacklesForLoss", "interceptions", "passesDefended"])) return FB_DEFENSE_PROFILE;
  const yards = ["passingYards", "rushingYards", "receivingYards"].filter((k) => games.some((g) => g.stats[k] != null));
  if (yards.length) {
    const tdTotals = ["passingTouchdowns", "rushingTouchdowns", "receivingTouchdowns"].filter((k) => games.some((g) => g.stats[k] != null));
    return { chart: yards.slice(0, 2), table: yards, totals: tdTotals };
  }
  return { chart: ["passingYards", "rushingYards"], table: ["passingYards", "rushingYards"], totals: [] };
}

export default function PlayerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const sport = params.get("sport") || "football";
  const name = params.get("name") || "Player";
  const teamName = params.get("team") || "";
  const teamLogo = params.get("logo") || "";
  const headshot = params.get("headshot") || "";
  const position = params.get("position") || "";
  const teamId = params.get("teamId") || "";

  const log = useQuery({
    queryKey: ["playerGameLog", sport, id, teamId],
    queryFn: () =>
      base44.functions.invoke("getPlayerGameLog", { sport, athleteId: id, teamId }).then((r) => r.data),
  });
  const games = log.data?.games || [];
  const seasonHistory = log.data?.seasonHistory || [];
  const STATS = sport === "basketball" ? BK_STATS : FB_STATS;
  // Prefer the position from the backend (reliable); fall back to the URL param.
  const effectivePosition = log.data?.position || position;
  const classification = log.data?.classification || "";
  const hometown = log.data?.hometown || "";
  const profile = getProfile(sport, effectivePosition, games);
  const hasKey = (k) => games.some((g) => g.stats?.[k] != null);
  const profileChart = profile.chart.filter(hasKey);
  const allWithData = Object.keys(STATS).filter(hasKey);
  const fallback = !profileChart.length;
  const chartKeys = fallback ? allWithData.slice(0, 2) : profileChart;
  const tableKeys = fallback ? allWithData : profile.table.filter(hasKey);
  const totalsKeys = fallback ? [] : (profile.totals || []).filter(hasKey);

  // Career stats: use the same profile, but filter by what the season history actually has.
  const careerHasKey = (k) => seasonHistory.some((s) => s.stats?.[k] != null);
  const careerTableKeys = fallback
    ? Object.keys(STATS).filter(careerHasKey)
    : (profile.table || []).filter(careerHasKey);

  const chartData = games.map((g) => {
    const row = { game: g.game, opponent: g.opponent, date: g.date, homeAway: g.homeAway };
    chartKeys.forEach((k) => {
      row[k] = g.stats?.[k] ?? null;
    });
    return row;
  });

  const avg = (key) => {
    const vals = games.map((g) => g.stats?.[key]).filter((v) => v != null);
    if (!vals.length) return null;
    return vals.reduce((s, v) => s + v, 0) / vals.length;
  };

  const total = (key) => {
    const vals = games.map((g) => g.stats?.[key]).filter((v) => v != null);
    if (!vals.length) return null;
    return vals.reduce((s, v) => s + v, 0);
  };

  const hasData = games.length > 0;
  const subtitle = `Game-by-game ${chartKeys.map((k) => STATS[k].label).join(" & ")} across the ${log.data?.season} season.`;

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={() =>
          window.history.state && window.history.state.idx > 0 ? navigate(-1) : navigate("/stat-leaders")
        }
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div className="flex items-center gap-4">
        <Headshot src={headshot} name={name} />
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">
            {name}
            {classification && (
              <span className="ml-2 text-sm font-medium text-muted-foreground align-middle">{classification}</span>
            )}
          </h1>
          <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
            {teamLogo && <TeamLogo src={teamLogo} alt={teamName} className="w-5 h-5" />}
            <span className="truncate">{teamName}</span>
            {effectivePosition && (
              <>
                <span className="text-border">·</span>
                <span className="uppercase">{effectivePosition}</span>
              </>
            )}
          </div>
          {hometown && (
            <p className="mt-0.5 text-xs text-muted-foreground truncate">Birthplace: {hometown}</p>
          )}
        </div>
      </div>

      {log.isLoading ? (
        <p className="text-muted-foreground">Loading season trend…</p>
      ) : !hasData ? (
        <p className="text-muted-foreground py-8 text-center rounded-xl border border-dashed border-border">
          No stats recorded for this player this season.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
            {chartKeys.map((k) => (
              <SummaryStat key={k} label={STATS[k].label} total={total(k)} avg={avg(k)} color={STATS[k].color} />
            ))}
            {totalsKeys.map((k) => (
              <TotalStat key={k} label={STATS[k].label} value={total(k)} color={STATS[k].color} />
            ))}
          </div>

          <RecentForm games={games} chartKeys={chartKeys} STATS={STATS} avg={avg} />

          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="font-semibold mb-1">Per Game Trend</h2>
            <p className="text-xs text-muted-foreground mb-4">{subtitle}</p>
            <div className="w-full" style={{ height: 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 8, left: -12 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="game"
                    tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                    tickLine={false}
                    axisLine={{ stroke: "hsl(var(--border))" }}
                    label={{ value: "Game", position: "insideBottom", dy: 10, fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                    tickLine={false}
                    axisLine={{ stroke: "hsl(var(--border))" }}
                  />
                  <Tooltip content={<ChartTooltip stats={STATS} />} />
                  <Legend />
                  {chartKeys.map((k) => (
                    <Line key={k} type="monotone" dataKey={k} name={STATS[k].label} stroke={STATS[k].color} strokeWidth={2} dot={{ r: 3 }} connectNulls />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Mobile: per-game cards */}
          <div className="sm:hidden space-y-2">
            {games.map((g, i) => (
              <div key={g.eventId || i} className="rounded-xl border border-border bg-card p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs text-muted-foreground tabular-nums shrink-0">G{g.game}</span>
                  {g.opponent?.logo && <TeamLogo src={g.opponent.logo} alt={g.opponent.name} className="w-5 h-5" />}
                  <span className="font-medium text-sm flex-1 min-w-0 truncate">
                    {g.homeAway === "home" ? "vs " : "@ "}
                    {g.opponent?.name || "—"}
                  </span>
                  {g.date && (
                    <span className="text-xs text-muted-foreground shrink-0">
                      {new Date(g.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                  {tableKeys.map((k) => (
                    <div key={k} className="flex items-center justify-between gap-2">
                      <span className="text-xs text-muted-foreground">{STATS[k].label}</span>
                      <span className="text-sm font-medium tabular-nums">{g.stats?.[k] ?? "—"}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {/* Desktop: per-game table */}
          <div className="hidden sm:block rounded-xl border border-border overflow-hidden bg-card">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground bg-muted/40">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium">G</th>
                    <th className="text-left px-2 py-2 font-medium">Opponent</th>
                    <th className="text-left px-2 py-2 font-medium">Date</th>
                    {tableKeys.map((k) => (
                      <th key={k} className="text-right px-2 py-2 font-medium last:pr-4">{STATS[k].label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {games.map((g, i) => (
                    <tr key={g.eventId || i} className="border-t border-border">
                      <td className="px-4 py-2.5 text-muted-foreground tabular-nums">{g.game}</td>
                      <td className="px-2 py-2.5">
                        <div className="flex items-center gap-2">
                          {g.opponent?.logo && <TeamLogo src={g.opponent.logo} alt={g.opponent.name} className="w-5 h-5" />}
                          <span className="font-medium">
                            {g.homeAway === "home" ? "vs " : "@ "}
                            {g.opponent?.name || "—"}
                          </span>
                        </div>
                      </td>
                      <td className="px-2 py-2.5 text-muted-foreground">
                        {g.date ? new Date(g.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}
                      </td>
                      {tableKeys.map((k) => (
                        <td key={k} className="px-2 py-2.5 text-right tabular-nums last:pr-4">{g.stats?.[k] ?? "—"}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Career stats — season-by-season totals, shown independently of the current game log. */}
      {seasonHistory.length > 0 && careerTableKeys.length > 0 && (
        <div className="space-y-2">
          <h2 className="font-semibold text-sm px-1">Career Stats</h2>
          {/* Mobile: career cards */}
          <div className="sm:hidden space-y-2">
            {seasonHistory.map((s, i) => (
              <div key={s.season} className={cn("rounded-xl border border-border bg-card p-3", i === 0 && "border-primary/30 bg-primary/5")}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-medium">
                      {s.season}
                      {i === 0 && <span className="ml-1.5 text-[10px] text-brand font-semibold">CURRENT</span>}
                    </span>
                    {s.team && (
                      <span className="flex items-center gap-1 min-w-0">
                        <TeamLogo src={s.team.logo} alt={s.team.name} className="w-4 h-4" />
                        <span className="text-xs text-muted-foreground truncate">{s.team.shortName || s.team.name}</span>
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">GP {s.gamesPlayed ?? "—"}</span>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                  {careerTableKeys.map((k) => (
                    <div key={k} className="flex items-center justify-between gap-2">
                      <span className="text-xs text-muted-foreground">{STATS[k].label}</span>
                      <span className="text-sm font-medium tabular-nums">{s.stats?.[k] ?? "—"}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {/* Desktop: career table */}
          <div className="hidden sm:block rounded-xl border border-border overflow-hidden bg-card">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground bg-muted/40">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium">Season</th>
                    <th className="text-left px-2 py-2 font-medium">Team</th>
                    <th className="text-center px-2 py-2 font-medium">GP</th>
                    {careerTableKeys.map((k) => (
                      <th key={k} className="text-right px-2 py-2 font-medium last:pr-4">{STATS[k].label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {seasonHistory.map((s, i) => (
                    <tr key={s.season} className={cn("border-t border-border", i === 0 && "bg-primary/5")}>
                      <td className="px-4 py-2.5 font-medium tabular-nums whitespace-nowrap">
                        {s.season}
                        {i === 0 && <span className="ml-1.5 text-[10px] text-brand font-semibold">CURRENT</span>}
                      </td>
                      <td className="px-2 py-2.5">
                        {s.team ? (
                          <div className="flex items-center gap-1.5">
                            <TeamLogo src={s.team.logo} alt={s.team.name} className="w-5 h-5" />
                            <span className="text-sm text-muted-foreground truncate">{s.team.shortName || s.team.name}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-2 py-2.5 text-center tabular-nums">{s.gamesPlayed ?? "—"}</td>
                      {careerTableKeys.map((k) => (
                        <td key={k} className="px-2 py-2.5 text-right tabular-nums last:pr-4">{s.stats?.[k] ?? "—"}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RecentForm({ games, chartKeys, STATS, avg }) {
  if (!games.length || !chartKeys.length) return null;
  const recentGames = games.slice(-3);
  const primaryKey = chartKeys[0];
  const seasonAvg = avg(primaryKey);
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h2 className="font-semibold mb-3 text-sm">Recent Form — {STATS[primaryKey].label}</h2>
      <div className="flex items-center gap-2">
        {recentGames.map((g, i) => {
          const val = g.stats?.[primaryKey];
          const trend =
            val != null && seasonAvg != null
              ? val > seasonAvg
                ? "up"
                : val < seasonAvg
                ? "down"
                : "flat"
              : null;
          return (
            <div key={g.eventId || i} className="flex-1 min-w-0 text-center px-1">
              <p className="text-xs text-muted-foreground mb-1 truncate">
                {g.opponent?.name || `G${g.game}`}
              </p>
              <p
                className={cn(
                  "text-lg font-bold tabular-nums",
                  trend === "up" && "text-green-600 dark:text-green-400",
                  trend === "down" && "text-red-600 dark:text-red-400"
                )}
              >
                {val ?? "—"}
              </p>
              <p className="text-[10px] text-muted-foreground truncate">
                {trend === "up" ? "↑ above avg" : trend === "down" ? "↓ below avg" : trend === "flat" ? "→ at avg" : ""}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SummaryStat({ label, total, avg, color }) {
  const fmt = (v) => (v == null ? "—" : Number.isInteger(v) ? v : v.toFixed(1));
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="flex flex-col gap-0.5 mt-0.5 sm:flex-row sm:items-baseline sm:justify-between">
        <div className="flex items-baseline gap-1.5">
          <span className="text-xl font-bold tabular-nums" style={{ color }}>{fmt(total)}</span>
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">total</span>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-sm font-semibold tabular-nums" style={{ color }}>{fmt(avg)}</span>
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">avg</span>
        </div>
      </div>
    </div>
  );
}

function TotalStat({ label, value, color }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3 sm:min-w-[100px]">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-bold tabular-nums mt-0.5" style={{ color }}>{value != null ? value : "—"}</p>
    </div>
  );
}

function ChartTooltip({ active, payload, label, stats }) {
  if (!active || !payload || !payload.length) return null;
  const g = payload[0]?.payload;
  return (
    <div className="rounded-lg border border-border bg-popover p-3 shadow-md text-xs">
      <p className="font-semibold mb-0.5">
        {g.opponent ? `${g.homeAway === "home" ? "vs " : "@ "}${g.opponent.name}` : `Game ${label}`}
      </p>
      {g.date && (
        <p className="text-muted-foreground mb-1">
          {new Date(g.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        </p>
      )}
      {payload.map((e) => (
        <p key={e.dataKey} style={{ color: e.color }} className="font-medium tabular-nums">
          {stats[e.dataKey]?.label || e.name}: {e.value ?? 0}
        </p>
      ))}
    </div>
  );
}

function Headshot({ src, name }) {
  const [err, setErr] = React.useState(false);
  if (!src || err) {
    return <div className="w-16 h-16 rounded-full bg-muted shrink-0" aria-label={name} />;
  }
  return (
    <img
      src={src}
      alt={name}
      loading="lazy"
      onError={() => setErr(true)}
      className="w-16 h-16 rounded-full object-cover shrink-0 bg-muted"
    />
  );
}