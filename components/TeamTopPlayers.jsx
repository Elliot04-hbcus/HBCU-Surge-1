import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

// Category metadata keyed by the leaderCategories bucket keys.
const FB_CATEGORIES = [
  { key: "passing", label: "Passing", unit: "YDS" },
  { key: "rushing", label: "Rushing", unit: "YDS" },
  { key: "receiving", label: "Receiving", unit: "YDS" },
  { key: "sacks", label: "Sacks", unit: "SACK" },
  { key: "interceptions", label: "Interceptions", unit: "INT" },
  { key: "tackles", label: "Tackles", unit: "TACK" },
];
const BK_CATEGORIES = [
  { key: "scoring", label: "Scoring", unit: "PPG" },
  { key: "assists", label: "Assists", unit: "APG" },
  { key: "rebounds", label: "Rebounds", unit: "RPG" },
  { key: "steals", label: "Steals", unit: "SPG" },
  { key: "blocks", label: "Blocks", unit: "BPG" },
];

export default function TeamTopPlayers({ sport, teamId, teamName, teamLogo }) {
  const q = useQuery({
    queryKey: ["teamPlayerLeaders", sport, teamId],
    queryFn: () => base44.functions.invoke("getTeamPlayerLeaders", { sport, teamId }).then((r) => r.data),
  });

  const leaders = q.data?.leaders || {};
  const cats = (sport === "basketball" ? BK_CATEGORIES : FB_CATEGORIES).filter((c) =>
    leaders[c.key]?.length
  );

  if (q.isLoading) return <p className="text-muted-foreground">Loading top players…</p>;
  if (q.error || cats.length === 0) {
    return (
      <p className="text-muted-foreground py-8 text-center rounded-xl border border-dashed border-border">
        No player stats available yet this season.
      </p>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {cats.map((c) => (
        <PlayerCard
          key={c.key}
          title={c.label}
          unit={c.unit}
          list={leaders[c.key] || []}
          sport={sport}
          teamId={teamId}
          teamName={teamName}
          teamLogo={teamLogo}
        />
      ))}
    </div>
  );
}

function PlayerCard({ title, unit, list, sport, teamId, teamName, teamLogo }) {
  const [expanded, setExpanded] = useState(false);
  const canExpand = list.length > 3;
  const visible = expanded ? list : list.slice(0, 3);

  const linkFor = (p) =>
    `/players/${p.athleteId}?${new URLSearchParams({
      sport,
      name: p.name || "",
      team: teamName || "",
      logo: teamLogo || "",
      headshot: p.headshot || "",
      position: p.position || "",
      teamId: String(teamId),
    }).toString()}`;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-muted/40">
        <span className="font-semibold text-sm">{title} Leaders</span>
        <span className="text-xs text-muted-foreground">{unit}</span>
      </div>
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
                <p className="text-sm font-semibold leading-snug truncate">{p.name}</p>
                <div className="flex items-center justify-between gap-2 mt-1">
                  <span className="text-xs text-muted-foreground truncate">
                    {p.position || ""}
                  </span>
                  <span className="text-sm font-bold tabular-nums shrink-0 text-primary">
                    {p.displayValue}
                  </span>
                </div>
              </div>
            </Link>
          </div>
        ))}
      </div>
      {canExpand && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="w-full py-2 text-xs font-medium text-muted-foreground hover:text-foreground border-t border-border transition flex items-center justify-center gap-1"
        >
          {expanded ? "Show less" : `Show top ${list.length}`}
          <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", expanded && "rotate-180")} />
        </button>
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