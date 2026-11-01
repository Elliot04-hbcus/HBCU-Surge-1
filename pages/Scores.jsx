import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useSport, SPORT_LABELS } from "@/components/SportContext";
import GameCard from "@/components/GameCard";
import { useFavorites } from "@/hooks/useFavorites";
import { ChevronLeft, ChevronRight } from "lucide-react";
import RefreshBar from "@/components/RefreshBar";
import PullToRefresh from "@/components/PullToRefresh";

function fmtDate(d) {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
}

const MAX_FOOTBALL_WEEK = 16;

export default function Scores() {
  const { sport } = useSport();
  const { favIds } = useFavorites(sport);
  const isFootball = sport === "football";
  const [offset, setOffset] = useState(0);
  const [currentWeek, setCurrentWeek] = useState(null);

  // offset 0 → default view (current week for football, upcoming for basketball)
  const fetchParam = isFootball
    ? offset === 0
      ? {}
      : { week: currentWeek != null ? currentWeek + offset : undefined }
    : offset === 0
    ? {}
    : { date: fmtDate(new Date(Date.now() + offset * 86400000)) };

  const keyPart = isFootball
    ? offset === 0
      ? "current"
      : "w" + (currentWeek != null ? currentWeek + offset : "x")
    : offset === 0
    ? "current"
    : fetchParam.date;

  const { data, isLoading, dataUpdatedAt, refetch, isFetching } = useQuery({
    queryKey: ["scoreboard", sport, keyPart],
    queryFn: () => base44.functions.invoke("getHbcuScoreboard", { sport, ...fetchParam }).then((r) => r.data),
    refetchInterval: (query) => {
      const gs = query.state.data?.games || [];
      return gs.some((g) => g.status?.state === "in") ? 30000 : false;
    },
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (isFootball && data?.week != null && currentWeek == null) setCurrentWeek(data.week);
  }, [data, isFootball, currentWeek]);

  useEffect(() => {
    setOffset(0);
    setCurrentWeek(null);
  }, [sport]);

  const effectiveWeek = currentWeek != null ? currentWeek + offset : null;
  const atMinWeek = isFootball && effectiveWeek != null && effectiveWeek <= 1;
  const atMaxWeek = isFootball && effectiveWeek != null && effectiveWeek >= MAX_FOOTBALL_WEEK;

  const label = isFootball
    ? effectiveWeek != null
      ? `Week ${effectiveWeek}`
      : "This Week"
    : offset === 0
    ? "Upcoming"
    : new Date(Date.now() + offset * 86400000).toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      });

  const games = data?.games || [];
  const hasLive = games.some((g) => g.status?.state === "in");
  const byDate = {};
  games.forEach((g) => {
    const d = (g.date || "").slice(0, 10);
    (byDate[d] = byDate[d] || []).push(g);
  });
  const dates = Object.keys(byDate).sort();
  const showHeaders = dates.length > 1;

  return (
    <PullToRefresh onRefresh={refetch}>
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{SPORT_LABELS[sport]} Scores</h1>
          <p className="text-muted-foreground text-sm">{data?.season ? `${data.season} Season · ` : ""}SWAC, MEAC & Other</p>
        </div>
        <div className="flex items-center gap-3">
          <RefreshBar onRefresh={refetch} isFetching={isFetching} dataUpdatedAt={dataUpdatedAt} live={hasLive} />
          <div className="flex items-center gap-2">
            <button
              onClick={() => setOffset((o) => o - 1)}
              disabled={atMinWeek}
              className="p-2 rounded-lg border border-border hover:bg-muted transition disabled:opacity-40 disabled:pointer-events-none"
              aria-label="Previous"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-medium w-32 text-center">{label}</span>
            <button
              onClick={() => setOffset((o) => o + 1)}
              disabled={atMaxWeek}
              className="p-2 rounded-lg border border-border hover:bg-muted transition disabled:opacity-40 disabled:pointer-events-none"
              aria-label="Next"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {offset !== 0 && (
        <button onClick={() => setOffset(0)} className="text-sm text-brand hover:underline">
          {isFootball ? "← Current week" : "← Upcoming"}
        </button>
      )}

      {isLoading ? (
        <p className="text-muted-foreground">Loading games…</p>
      ) : games.length === 0 ? (
        <p className="text-muted-foreground py-12 text-center rounded-xl border border-dashed border-border">
          No {SPORT_LABELS[sport].toLowerCase()} games scheduled{isFootball ? " this week" : " on this day"}.
        </p>
      ) : (
        dates.map((d) => (
          <div key={d}>
            {showHeaders && (
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                {new Date(d).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
              </h2>
            )}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              {[...byDate[d]].sort((a, b) => {
                const af = (a.competitors || []).some((c) => favIds.has(String(c.id)));
                const bf = (b.competitors || []).some((c) => favIds.has(String(c.id)));
                if (af !== bf) return af ? -1 : 1;
                return 0;
              }).map((g) => (
                <GameCard key={g.id} game={g} />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
    </PullToRefresh>
  );
}