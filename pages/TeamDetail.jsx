import React, { useState, useMemo } from "react";
import { useParams, useSearchParams, Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import TeamLogo from "@/components/TeamLogo";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import MobileSelect from "@/components/MobileSelect";
import { ArrowLeft, CalendarDays, Users, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import FavoriteButton from "@/components/FavoriteButton";
import SyncScheduleButton from "@/components/SyncScheduleButton";
import TeamTopPlayers from "@/components/TeamTopPlayers";

const FB_POS_ORDER = ["QB", "RB", "FB", "WR", "TE", "OT", "OG", "C", "OL", "DE", "DT", "DL", "NG", "EDGE", "LB", "ILB", "OLB", "MLB", "DB", "CB", "S", "SS", "FS", "NB", "K", "P", "LS", "H"];
const BK_POS_ORDER = ["PG", "SG", "G", "SF", "PF", "F", "C"];

export default function TeamDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const sport = params.get("sport") || "football";
  const name = params.get("name") || "Team";
  const logo = params.get("logo") || "";

  const schedule = useQuery({
    queryKey: ["schedule", sport, id],
    queryFn: () => base44.functions.invoke("getTeamSchedule", { sport, teamId: id }).then((r) => r.data),
  });
  const roster = useQuery({
    queryKey: ["roster", sport, id],
    queryFn: () => base44.functions.invoke("getTeamRoster", { sport, teamId: id }).then((r) => r.data),
  });

  const games = schedule.data?.games || [];
  const athletes = roster.data?.athletes || [];
  const teamMeta = schedule.data?.team;

  const posOrder = sport === "basketball" ? BK_POS_ORDER : FB_POS_ORDER;
  const sortedAthletes = [...athletes].sort((a, b) => {
    const ai = posOrder.indexOf((a.position || "").toUpperCase());
    const bi = posOrder.indexOf((b.position || "").toUpperCase());
    const aRank = ai === -1 ? posOrder.length : ai;
    const bRank = bi === -1 ? posOrder.length : bi;
    if (aRank !== bRank) return aRank - bRank;
    return (a.position || "").localeCompare(b.position || "");
  });

  const [posFilter, setPosFilter] = useState("");
  const [yearFilter, setYearFilter] = useState("");

  const uniquePositions = useMemo(() => {
    const seen = new Set();
    sortedAthletes.forEach((a) => { if (a.position) seen.add(a.position); });
    return [...seen].sort((a, b) => {
      const ai = posOrder.indexOf(a.toUpperCase());
      const bi = posOrder.indexOf(b.toUpperCase());
      return (ai === -1 ? posOrder.length : ai) - (bi === -1 ? posOrder.length : bi);
    });
  }, [sortedAthletes, posOrder]);

  const uniqueYears = useMemo(() => {
    const seen = new Set();
    sortedAthletes.forEach((a) => { if (a.year) seen.add(a.year); });
    return [...seen];
  }, [sortedAthletes]);

  const filteredAthletes = sortedAthletes.filter(
    (a) => (!posFilter || a.position === posFilter) && (!yearFilter || a.year === yearFilter)
  );

  const playerLink = (a) =>
    `/players/${a.id}?${new URLSearchParams({
      sport,
      name: a.name || "",
      team: teamMeta?.name || name,
      logo: logo || teamMeta?.logo || "",
      headshot: a.headshot || "",
      position: a.position || "",
      teamId: String(id),
    }).toString()}`;

  function resultFor(g) {
    const me = (g.competitors || []).find((c) => String(c.id) === String(id));
    const opp = (g.competitors || []).find((c) => String(c.id) !== String(id));
    if (!me || !opp) return null;
    return {
      opponent: opp,
      home: me.homeAway === "home",
      completed: g.status?.completed,
      win: me.winner,
      myScore: me.score,
      oppScore: opp.score,
      detail: g.status?.detail || g.status?.shortDetail,
      venue: g.venue,
    };
  }

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={() =>
          window.history.state && window.history.state.idx > 0 ? navigate(-1) : navigate("/teams")
        }
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div className="flex items-center gap-4">
        <TeamLogo src={logo || teamMeta?.logo} alt={name} className="w-16 h-16" />
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">{teamMeta?.name || name}</h1>
          <p className="text-muted-foreground text-sm capitalize">
            {sport}
            {teamMeta?.record ? ` · ${teamMeta.record}` : ""}
            {teamMeta?.confRecord ? ` (${teamMeta.confRecord} conf)` : ""}
          </p>
        </div>
        <div className="ml-auto">
          <FavoriteButton
            team={{ id, name: teamMeta?.name || name, logo: logo || teamMeta?.logo || "" }}
            sport={sport}
          />
        </div>
      </div>

      <Tabs defaultValue="schedule">
        <TabsList>
          <TabsTrigger value="schedule">
            <CalendarDays className="w-4 h-4 mr-1.5" /> Schedule
          </TabsTrigger>
          <TabsTrigger value="roster">
            <Users className="w-4 h-4 mr-1.5" /> Roster
          </TabsTrigger>
          <TabsTrigger value="top">
            <Star className="w-4 h-4 mr-1.5" /> Top Players
          </TabsTrigger>
        </TabsList>

        <TabsContent value="schedule" className="mt-4">
          {games.length > 0 && !schedule.isLoading && (
            <div className="flex justify-end mb-3">
              <SyncScheduleButton games={games} teamName={teamMeta?.name || name} sport={sport} />
            </div>
          )}
          {schedule.isLoading ? (
            <p className="text-muted-foreground">Loading schedule…</p>
          ) : games.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center rounded-xl border border-dashed border-border">
              No games scheduled this season.
            </p>
          ) : (
            <div className="rounded-xl border border-border overflow-hidden bg-card">
              {games.map((g, i) => {
                const r = resultFor(g);
                if (!r) return null;
                const d = new Date(g.date);
                return (
                  <Link
                    key={g.id}
                    to={`/games/${g.id}?sport=${sport}`}
                    className={cn("flex items-center gap-4 px-4 py-3 hover:bg-muted/30 transition", i > 0 && "border-t border-border")}
                  >
                    <div className="w-12 shrink-0 text-center">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        {d.toLocaleDateString("en-US", { month: "short" })}
                      </p>
                      <p className="text-lg font-bold tabular-nums leading-none">{d.getDate()}</p>
                    </div>
                    <TeamLogo src={r.opponent.logo} alt={r.opponent.name} className="w-8 h-8 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className={cn("truncate", r.completed ? "font-medium" : "font-semibold")}>
                        {r.home ? "vs" : "@"} {r.opponent.name}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {r.opponent.conference && <span className="text-foreground/60 font-medium">{r.opponent.conference}</span>}
                        {r.opponent.conference && r.venue ? " · " : ""}
                        {r.venue ? `${r.venue.name}${r.venue.city ? ", " + r.venue.city : ""}` : ""}
                      </p>
                    </div>
                    {r.completed ? (
                      <span
                        className={cn(
                          "text-sm font-bold tabular-nums shrink-0",
                          r.win ? "text-green-600" : "text-destructive"
                        )}
                      >
                        {r.win ? "W" : "L"} {r.myScore}-{r.oppScore}
                      </span>
                    ) : (
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold tabular-nums">
                          {d.toLocaleDateString("en-US", { weekday: "short" })}
                        </p>
                        <p className="text-xs text-muted-foreground tabular-nums">
                          {d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                        </p>
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="roster" className="mt-4">
          {roster.isLoading ? (
            <p className="text-muted-foreground">Loading roster…</p>
          ) : athletes.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center rounded-xl border border-dashed border-border">
              No roster data available right now.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap gap-3 mb-4">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Position</label>
                  <MobileSelect
                    value={posFilter || "all"}
                    onValueChange={(v) => setPosFilter(v === "all" ? "" : v)}
                    options={[{ value: "all", label: "All Positions" }, ...uniquePositions.map((p) => ({ value: p, label: p }))]}
                    placeholder="All Positions"
                    triggerClassName="min-w-[140px]"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Class</label>
                  <MobileSelect
                    value={yearFilter || "all"}
                    onValueChange={(v) => setYearFilter(v === "all" ? "" : v)}
                    options={[{ value: "all", label: "All Classes" }, ...uniqueYears.map((y) => ({ value: y, label: y }))]}
                    placeholder="All Classes"
                    triggerClassName="min-w-[140px]"
                  />
                </div>
                {(posFilter || yearFilter) && (
                  <button
                    onClick={() => { setPosFilter(""); setYearFilter(""); }}
                    className="self-end text-xs text-muted-foreground hover:text-foreground underline"
                  >
                    Clear filters
                  </button>
                )}
              </div>

              <div className="rounded-xl border border-border overflow-hidden bg-card">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-xs text-muted-foreground bg-muted/40">
                      <tr>
                        <th className="text-left px-4 py-2 font-medium">#</th>
                        <th className="text-left px-2 py-2 font-medium">Player</th>
                        <th className="text-left px-2 py-2 font-medium">Pos</th>
                        <th className="text-left px-2 py-2 font-medium hidden sm:table-cell">Yr</th>
                        <th className="text-left px-2 py-2 font-medium hidden sm:table-cell">Ht</th>
                        <th className="text-left px-4 py-2 font-medium hidden md:table-cell">Hometown</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAthletes.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                            No players match the selected filters.
                          </td>
                        </tr>
                      ) : (
                        filteredAthletes.map((a, i) => (
                          <tr key={a.id || a.name || i} className="border-t border-border hover:bg-muted/30 transition">
                            <td className="px-4 py-2.5 text-muted-foreground tabular-nums">{a.jersey || "—"}</td>
                            <td className="px-2 py-2.5 font-medium">
                              <Link to={playerLink(a)} className="hover:text-primary hover:underline">{a.name}</Link>
                            </td>
                            <td className="px-2 py-2.5">{a.position || "—"}</td>
                            <td className="px-2 py-2.5 hidden sm:table-cell">{a.year || "—"}</td>
                            <td className="px-2 py-2.5 hidden sm:table-cell">{a.height || "—"}</td>
                            <td className="px-4 py-2.5 hidden md:table-cell text-muted-foreground">{a.hometown || "—"}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="top" className="mt-4">
          <TeamTopPlayers
            sport={sport}
            teamId={String(id)}
            teamName={teamMeta?.name || name}
            teamLogo={logo || teamMeta?.logo || ""}
          />
        </TabsContent>

      </Tabs>
    </div>
  );
}