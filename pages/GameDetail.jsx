import React, { useState } from "react";
import { useParams, useSearchParams, useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import TeamLogo from "@/components/TeamLogo";
import { ArrowLeft, Radio, Users, ChevronDown } from "lucide-react";
import RefreshBar from "@/components/RefreshBar";
import ShareGameButton from "@/components/ShareGameButton";
import RecentTeamGames from "@/components/RecentTeamGames";
import CountdownTimer from "@/components/CountdownTimer";
import { cn } from "@/lib/utils";

export default function GameDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const sport = params.get("sport") === "basketball" ? "basketball" : "football";

  const q = useQuery({
    queryKey: ["gameSummary", sport, id],
    queryFn: () =>
      base44.functions.invoke("getGameSummary", { sport, eventId: id }).then((r) => r.data),
    refetchInterval: (query) => (query.state.data?.status?.state === "in" ? 30000 : false),
  });

  const data = q.data;
  const live = data?.status?.state === "in";
  const isPreview = data?.status?.state === "pre";
  const away = data?.competitors?.find((c) => c.homeAway === "away") || data?.competitors?.[0];
  const home = data?.competitors?.find((c) => c.homeAway === "home") || data?.competitors?.[1];

  const tabs = [
    {
      id: "players",
      label: "Player Box Score",
      show: data?.playerStats?.some((t) => t.categories.length > 0),
    },
    { id: "plays", label: "Play by Play", show: data?.plays?.length > 0 },
    { id: "scoring", label: "Scoring Plays", show: data?.scoringPlays?.length > 0 },
    { id: "boxscore", label: "Box Score", show: data?.boxscore?.length > 0 },
  ].filter((t) => t.show);
  const [tab, setTab] = useState(tabs[0]?.id || "players");
  const activeTab = tabs.find((t) => t.id === tab) ? tab : tabs[0]?.id;

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={() =>
          window.history.state && window.history.state.idx > 0 ? navigate(-1) : navigate("/scores")
        }
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      {data && (
        <div className="flex justify-end gap-2">
          <ShareGameButton away={away} home={home} status={data.status} sport={sport} />
          <RefreshBar onRefresh={q.refetch} isFetching={q.isFetching} dataUpdatedAt={q.dataUpdatedAt} live={live} />
        </div>
      )}

      {q.isLoading ? (
        <p className="text-muted-foreground">Loading game…</p>
      ) : !data ? (
        <p className="text-muted-foreground py-8 text-center rounded-xl border border-dashed border-border">
          Game details unavailable.
        </p>
      ) : (
        <>
          <ScoreHeader away={away} home={home} status={data.status} live={live} sport={sport} />

          {isPreview && data.date && <CountdownTimer date={data.date} sport={sport} />}

          {live && data.situation && <Situation situation={data.situation} />}

          {tabs.length > 0 && (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="flex border-b border-border overflow-x-auto no-scrollbar">
                {tabs.map((t) => {
                  const isActive = t.id === activeTab;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setTab(t.id)}
                      className={cn(
                        "flex-1 min-w-max px-4 py-3 text-sm font-medium whitespace-nowrap transition",
                        isActive
                          ? "text-foreground border-b-2 border-brand bg-muted/20"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>

              <div className="p-0">
                {activeTab === "scoring" && (
                  <ScoringPlays plays={data.scoringPlays} away={away} home={home} embedded />
                )}
                {activeTab === "boxscore" && (
                  <BoxScore teams={data.boxscore} away={away} home={home} embedded />
                )}
                {activeTab === "players" && (
                  <PlayerBoxScore
                    playerStats={data.playerStats}
                    away={away}
                    home={home}
                    sport={sport}
                    embedded
                  />
                )}
                {activeTab === "plays" && <PlayByPlay plays={data.plays} embedded />}
              </div>
            </div>
          )}

          {isPreview && away && home && (
            <RecentTeamGames away={away} home={home} sport={sport} />
          )}
        </>
      )}
    </div>
  );
}

function ScoreHeader({ away, home, status, live, sport }) {
  const periods = Math.max(away?.linescores?.length || 0, home?.linescores?.length || 0);
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between text-xs mb-4">
        <span className={cn("font-medium flex items-center gap-1.5", live && "text-brand")}>
          {live && <span className="w-2 h-2 rounded-full bg-brand animate-pulse" />}
          {status?.detail || status?.shortDetail || "Scheduled"}
        </span>
        {live && (
          <span className="inline-flex items-center gap-1 text-brand font-semibold text-xs">
            <Radio className="w-3.5 h-3.5" /> LIVE
          </span>
        )}
      </div>
      <TeamLine c={away} />
      <div className="h-3" />
      <TeamLine c={home} />
      {periods > 0 && (
        <div className="mt-4 pt-3 border-t border-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr>
                <th className="text-left font-medium pb-1"></th>
                {Array.from({ length: periods }, (_, i) => (
                  <th key={i} className="text-center font-medium px-1 pb-1">
                    {sport === "football" ? `Q${i + 1}` : `P${i + 1}`}
                  </th>
                ))}
                <th className="text-center font-medium pl-1 pb-1">T</th>
              </tr>
            </thead>
            <tbody>
              {[away, home].map((c) => (
                <tr key={c?.id} className="border-t border-border">
                  <td className="py-1.5 text-xs text-muted-foreground truncate max-w-[100px]">
                    {c?.abbreviation || c?.shortName}
                  </td>
                  {(c?.linescores || []).map((l, i) => (
                    <td key={i} className="text-center tabular-nums px-1">
                      {l}
                    </td>
                  ))}
                  <td className="text-center font-bold tabular-nums pl-1">{c?.score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function TeamLine({ c }) {
  if (!c) return null;
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3 min-w-0">
        <TeamLogo src={c.logo} alt={c.name} className="w-10 h-10" />
        <div className="min-w-0">
          <p className="font-semibold truncate">{c.name}</p>
        </div>
      </div>
      <span className="text-3xl font-bold tabular-nums">{c.score ?? "—"}</span>
    </div>
  );
}

function Situation({ situation }) {
  return (
    <div className="rounded-xl border border-brand/40 bg-brand/5 p-4">
      <p className="text-xs font-semibold text-brand uppercase tracking-wide mb-1">Live Situation</p>
      <p className="text-sm font-medium">{situation.downDistanceText}</p>
      {situation.possession && (
        <p className="text-xs text-muted-foreground mt-0.5">{situation.possession}</p>
      )}
    </div>
  );
}

function ScoringPlays({ plays, away, home, embedded }) {
  const teamFor = (teamId) => {
    if (away?.id === String(teamId)) return away;
    if (home?.id === String(teamId)) return home;
    return null;
  };
  const list = (
    <div className="max-h-96 overflow-y-auto">
      {[...plays].reverse().map((p, i) => {
        const t = teamFor(p.teamId);
        return (
          <div
            key={p.id || i}
            className={cn("flex items-start gap-3 px-4 py-2.5", i > 0 && "border-t border-border")}
          >
            <span className="text-xs text-muted-foreground tabular-nums w-10 shrink-0 pt-0.5">
              {p.period}
            </span>
            {t && <TeamLogo src={t.logo} alt={t.name} className="w-5 h-5 mt-0.5 shrink-0" />}
            <div className="flex-1 min-w-0">
              <p className="text-sm leading-snug">{p.text}</p>
              <p className="text-xs text-muted-foreground tabular-nums">{p.awayScore}-{p.homeScore}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
  if (embedded) return list;
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 bg-muted/40 font-semibold text-sm">Scoring Plays</div>
      {list}
    </div>
  );
}

function BoxScore({ teams, away, home, embedded }) {
  const awayStats = teams.find((t) => t.homeAway === "away") || teams[0];
  const homeStats = teams.find((t) => t.homeAway === "home") || teams[1];
  const rows = (awayStats?.statistics || []).map((s) => ({
    label: s.label,
    away: s.value,
    home: (homeStats?.statistics || []).find((x) => x.name === s.name)?.value || "—",
  }));
  const table = (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-xs text-muted-foreground">
          <tr className="border-b border-border">
            <th className="text-left px-4 py-2 font-medium">Stat</th>
            <th className="text-center px-2 py-2 font-medium">{away?.abbreviation}</th>
            <th className="text-center px-2 py-2 font-medium">{home?.abbreviation}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className={cn(i > 0 && "border-t border-border")}>
              <td className="px-4 py-2 text-muted-foreground">{r.label}</td>
              <td className="text-center px-2 py-2 tabular-nums">{r.away}</td>
              <td className="text-center px-2 py-2 tabular-nums">{r.home}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
  if (embedded) return table;
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 bg-muted/40 font-semibold text-sm">Box Score</div>
      {table}
    </div>
  );
}

function PlayerBoxScore({ playerStats, away, home, sport, embedded }) {
  const [tab, setTab] = useState(away?.homeAway || "away");
  const [openCat, setOpenCat] = useState(0);
  const active = playerStats.find((t) => t.homeAway === tab) || playerStats[0];
  if (!active) return null;

  const cats = active.categories || [];
  const switchTeam = (ha) => {
    setTab(ha);
    setOpenCat(0);
  };
  const teamObj = tab === away?.homeAway ? away : home;
  const playerLink = (a) =>
    `/players/${a.id}?${new URLSearchParams({
      sport,
      name: a.name || "",
      team: teamObj?.name || "",
      logo: teamObj?.logo || "",
      headshot: a.headshot || "",
      position: a.position || "",
      teamId: String(teamObj?.id || ""),
    }).toString()}`;

  const body = (
    <>
      <div className="flex border-b border-border">
        {[away, home].filter(Boolean).map((t) => {
          const isActive = t.homeAway === tab;
          return (
            <button
              key={t.id}
              onClick={() => switchTeam(t.homeAway)}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition",
                isActive
                  ? "text-foreground border-b-2 border-brand bg-muted/20"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t.logo && <TeamLogo src={t.logo} alt={t.name} className="w-5 h-5" />}
              {t.abbreviation || t.shortName}
            </button>
          );
        })}
      </div>
      <div className="divide-y divide-border">
        {cats.map((cat, i) => {
          const isOpen = i === openCat;
          return (
            <div key={cat.name}>
              <button
                onClick={() => setOpenCat(isOpen ? -1 : i)}
                className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold uppercase tracking-wide hover:bg-muted/30 transition"
              >
                <span className={cn(isOpen ? "text-foreground" : "text-muted-foreground")}>
                  {cat.label}
                </span>
                <ChevronDown
                  className={cn(
                    "w-4 h-4 text-muted-foreground transition-transform",
                    isOpen && "rotate-180"
                  )}
                />
              </button>
              {isOpen && (
                <div className="px-3 pb-3">
                  <div className="overflow-x-auto rounded-lg border border-border">
                    <table className="w-full text-sm">
                      <thead className="text-xs text-muted-foreground bg-muted/30">
                        <tr>
                          <th className="text-left px-2 py-1.5 font-medium sticky left-0 bg-muted/30">
                            Player
                          </th>
                          {cat.labels.map((l, j) => (
                            <th key={j} className="text-center px-2 py-1.5 font-medium whitespace-nowrap">
                              {l}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {cat.athletes.map((a, k) => (
                          <tr key={a.id || k} className={cn(k > 0 && "border-t border-border")}>
                            <td className="px-2 py-1.5 sticky left-0 bg-card whitespace-nowrap max-w-[140px] truncate">
                              {a.jersey && (
                                <span className="text-muted-foreground mr-1 text-xs">#{a.jersey}</span>
                              )}
                              <Link
                                to={playerLink(a)}
                                className="font-medium text-brand hover:underline"
                              >
                                {a.name}
                              </Link>
                              {a.position && (
                                <span className="text-muted-foreground ml-1 text-xs">{a.position}</span>
                              )}
                            </td>
                            {a.values.map((v, j) => (
                              <td key={j} className="text-center px-2 py-1.5 tabular-nums whitespace-nowrap">
                                {v || "—"}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );

  if (embedded) return body;
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 bg-muted/40 font-semibold text-sm flex items-center gap-2">
        <Users className="w-4 h-4 text-brand" /> Player Box Score
      </div>
      {body}
    </div>
  );
}

function PlayByPlay({ plays, embedded }) {
  const list = (
    <div className="max-h-[28rem] overflow-y-auto divide-y divide-border">
      {plays.map((p, i) => (
        <div key={p.id || i} className="flex items-start gap-3 px-4 py-2.5">
          <span className="text-xs text-muted-foreground tabular-nums w-16 shrink-0 pt-0.5">
            {p.period}
            {p.clock ? ` · ${p.clock}` : ""}
          </span>
          <p className="text-sm leading-snug flex-1 min-w-0">{p.text}</p>
        </div>
      ))}
    </div>
  );
  if (embedded) return list;
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 bg-muted/40 font-semibold text-sm">Play by Play</div>
      {list}
    </div>
  );
}