import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useSport, SPORT_LABELS } from "@/components/SportContext";
import TeamLogo from "@/components/TeamLogo";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Users, BarChart3, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import SeasonSelector from "@/components/SeasonSelector";

const PLAYER_CATEGORIES = {
  football: [
    { key: "passing", label: "Passing", unit: "YDS" },
    { key: "rushing", label: "Rushing", unit: "YDS" },
    { key: "receiving", label: "Receiving", unit: "YDS" },
    { key: "sacks", label: "Sacks", unit: "SACK" },
    { key: "interceptions", label: "Interceptions", unit: "INT" },
    { key: "tackles", label: "Tackles", unit: "TACK" },
  ],
  basketball: [
    { key: "scoring", label: "Scoring", unit: "PPG" },
    { key: "assists", label: "Assists", unit: "APG" },
    { key: "rebounds", label: "Rebounds", unit: "RPG" },
    { key: "steals", label: "Steals", unit: "SPG" },
    { key: "blocks", label: "Blocks", unit: "BPG" },
  ],
};

export default function StatLeaders() {
  const { sport } = useSport();
  const [tab, setTab] = useState("players");
  const [season, setSeason] = useState(null);

  const players = useQuery({
    queryKey: ["playerLeaders", sport, season],
    queryFn: () =>
      base44.functions.invoke("getHbcuPlayerLeaders", { sport, season: season || undefined }).then((r) => r.data),
  });
  const teams = useQuery({
    queryKey: ["teamStatLeaders", sport],
    queryFn: () => base44.functions.invoke("getHbcuTeamStatLeaders", { sport }).then((r) => r.data),
    enabled: tab === "teams",
  });

  const leaders = players.data?.leaders || {};
  const playerCats = PLAYER_CATEGORIES[sport];
  const hasPlayers = players.data && Object.keys(leaders).length > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{SPORT_LABELS[sport]} Stat Leaders</h1>
          <p className="text-muted-foreground text-sm">
            Top HBCU players and teams across SWAC, MEAC & Other.
          </p>
        </div>
        <SeasonSelector sport={sport} value={season} onChange={setSeason} />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="players">
            <Users className="w-4 h-4 mr-1.5" /> Players
          </TabsTrigger>
          <TabsTrigger value="teams">
            <BarChart3 className="w-4 h-4 mr-1.5" /> Teams
          </TabsTrigger>
        </TabsList>

        <TabsContent value="players" className="mt-4">
          {players.isLoading ? (
            <p className="text-muted-foreground">Loading player leaders…</p>
          ) : !hasPlayers ? (
            <EmptyState message="No player stats available yet this season." />
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              {playerCats.map((c) => (
                <PlayerCard key={c.key} title={c.label} unit={c.unit} list={leaders[c.key] || []} sport={sport} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="teams" className="mt-4">
          {tab === "teams" && teams.isLoading ? (
            <p className="text-muted-foreground">Loading team leaders…</p>
          ) : teams.data && (teams.data.categories || []).length === 0 ? (
            <EmptyState message="No team stats available yet this season." />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {(teams.data?.categories || []).map((c) => (
                <TeamStatCard key={c.key} title={c.label} list={c.leaders} sport={sport} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function EmptyState({ message }) {
  return (
    <p className="text-muted-foreground py-8 text-center rounded-xl border border-dashed border-border">
      {message}
    </p>
  );
}

function PlayerCard({ title, unit, list, sport }) {
  const [expanded, setExpanded] = useState(false);
  const canExpand = list.length > 5;
  const visible = expanded ? list : list.slice(0, 5);

  const linkFor = (p) =>
    `/players/${p.athleteId}?${new URLSearchParams({
      sport,
      name: p.name || "",
      team: p.team?.name || "",
      logo: p.team?.logo || "",
      headshot: p.headshot || "",
      position: p.position || "",
      teamId: p.team?.id || "",
    }).toString()}`;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        type="button"
        disabled={!canExpand}
        onClick={() => setExpanded((e) => !e)}
        className={cn(
          "flex items-center justify-between w-full px-4 py-3 bg-muted/40 text-left",
          canExpand && "hover:bg-muted/70 cursor-pointer transition"
        )}
      >
        <span className="font-semibold text-sm">{title} Leaders</span>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {unit}
          {canExpand && (
            <ChevronDown className={cn("w-4 h-4 transition-transform", expanded && "rotate-180")} />
          )}
        </span>
      </button>

      {list.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-muted-foreground">No data.</p>
      ) : (
        <div>
          {visible.map((p, i) => (
            <div
              key={p.athleteId || i}
              className={cn("flex items-start gap-3 px-4 py-2.5", i > 0 && "border-t border-border")}
            >
              <span className="w-5 text-center text-sm font-bold text-muted-foreground tabular-nums">
                {p.rank}
              </span>
              <Link to={linkFor(p)} className="flex items-start gap-3 flex-1 min-w-0 rounded hover:opacity-80 transition">
                <Headshot src={p.headshot} name={p.name} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold leading-snug">
                    {p.name}
                    {p.position && <span className="ml-1 text-xs text-muted-foreground">· {p.position}</span>}
                  </p>
                  <div className="flex items-center justify-between gap-2 mt-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <TeamLogo src={p.team?.logo} alt={p.team?.name} className="w-4 h-4" />
                      <span className="text-xs text-muted-foreground truncate">{p.team?.name}</span>
                    </div>
                    <span className="text-sm font-bold tabular-nums shrink-0 text-primary">
                      {p.displayValue}
                    </span>
                  </div>
                </div>
              </Link>
            </div>
          ))}
        </div>
      )}

      {canExpand && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="w-full py-2 text-xs font-medium text-muted-foreground hover:text-foreground border-t border-border transition"
        >
          {expanded ? "Show less" : `Show top ${list.length}`}
        </button>
      )}
    </div>
  );
}

function TeamStatCard({ title, list, sport }) {
  const teamLink = (t) =>
    `/teams/${t.team?.id}?${new URLSearchParams({
      sport,
      name: t.team?.name || "",
      logo: t.team?.logo || "",
    }).toString()}`;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 bg-muted/40 font-semibold text-sm">{title}</div>
      {list.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-muted-foreground">No data.</p>
      ) : (
        <div>
          {list.map((t, i) => (
            <Link
              key={t.team?.id || i}
              to={teamLink(t)}
              className={cn(
                "flex items-center gap-3 px-4 py-2.5 rounded hover:bg-muted/30 transition",
                i > 0 && "border-t border-border"
              )}
            >
              <span className="w-5 text-center text-sm font-bold text-muted-foreground tabular-nums">
                {t.rank}
              </span>
              <TeamLogo src={t.team?.logo} alt={t.team?.name} className="w-6 h-6" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{t.team?.name}</p>
                <span className="text-xs text-muted-foreground">
                  {t.team?.conference}
                  {t.team?.record ? ` · ${t.team.record}` : ""}
                </span>
              </div>
              <span className="text-sm font-bold tabular-nums shrink-0">{t.displayValue}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function Headshot({ src, name }) {
  const [err, setErr] = useState(false);
  if (!src || err) {
    return <div className="w-8 h-8 rounded-full bg-muted shrink-0" aria-label={name} />;
  }
  return (
    <img
      src={src}
      alt={name}
      loading="lazy"
      onError={() => setErr(true)}
      className="w-8 h-8 rounded-full object-cover shrink-0 bg-muted"
    />
  );
}