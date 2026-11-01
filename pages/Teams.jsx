import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useSport, SPORT_LABELS } from "@/components/SportContext";
import TeamCard from "@/components/TeamCard";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFavorites } from "@/hooks/useFavorites";

export default function Teams() {
  const { sport } = useSport();
  const { favIds } = useFavorites(sport);
  const [conf, setConf] = useState("All");
  const [q, setQ] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["standings", sport],
    queryFn: () => base44.functions.invoke("getHbcuStandings", { sport }).then((r) => r.data),
  });

  const teams = useMemo(() => {
    let t = data?.teams || [];
    if (conf === "Other") {
      t = t.filter((x) => x.conference !== "SWAC" && x.conference !== "MEAC");
    } else {
      if (conf !== "All") t = t.filter((x) => x.conference === conf);
    }
    if (q) t = t.filter((x) => x.name.toLowerCase().includes(q.toLowerCase()));
    return [...t].sort((a, b) => {
      const af = favIds.has(String(a.id));
      const bf = favIds.has(String(b.id));
      if (af !== bf) return af ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }, [data, conf, q, favIds]);

  // SWAC splits into East / West divisions — group when that split exists.
  const divisions = useMemo(() => {
    if (conf !== "SWAC") return null;
    const map = {};
    teams.forEach((t) => {
      const d = (t.division || "").replace(/^SWAC\s*-\s*/, "").trim() || "SWAC";
      (map[d] = map[d] || []).push(t);
    });
    const keys = Object.keys(map).sort();
    if (keys.length <= 1) return null;
    return keys.map((name) => ({
      name,
      teams: map[name].sort((a, b) => {
        const af = favIds.has(String(a.id));
        const bf = favIds.has(String(b.id));
        if (af !== bf) return af ? -1 : 1;
        return a.name.localeCompare(b.name);
      }),
    }));
  }, [teams, conf, favIds]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{SPORT_LABELS[sport]} Teams</h1>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
        <div className="inline-flex rounded-full bg-muted p-1 self-start">
          {["All", "SWAC", "MEAC", "Other"].map((c) => (
            <button
              key={c}
              onClick={() => setConf(c)}
              className={cn(
                "px-4 py-1.5 rounded-full text-sm font-medium transition",
                conf === c ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search teams"
            className="pl-9 pr-3 py-2 rounded-lg border border-border bg-card text-sm w-full sm:w-56"
          />
        </div>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading teams…</p>
      ) : teams.length === 0 ? (
        <p className="text-muted-foreground py-8 text-center">No teams found.</p>
      ) : divisions ? (
        <div className="space-y-8">
          {divisions.map((div) => (
            <div key={div.name}>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                {div.name} Division
              </h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {div.teams.map((t) => (
                  <TeamCard key={t.id} team={t} sport={sport} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {teams.map((t) => (
            <TeamCard key={t.id} team={t} sport={sport} />
          ))}
        </div>
      )}
    </div>
  );
}