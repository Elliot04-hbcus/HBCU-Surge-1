import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useSport, SPORT_LABELS } from "@/components/SportContext";
import GameCard from "@/components/GameCard";
import TeamLogo from "@/components/TeamLogo";
import { Trophy, ArrowRight, ListOrdered } from "lucide-react";

export default function Home() {
  const { sport } = useSport();
  const scoreboard = useQuery({
    queryKey: ["scoreboard", sport, "home"],
    queryFn: () => base44.functions.invoke("getHbcuScoreboard", { sport }).then((r) => r.data),
  });
  const standings = useQuery({
    queryKey: ["standings", sport],
    queryFn: () => base44.functions.invoke("getHbcuStandings", { sport }).then((r) => r.data),
  });

  const games = scoreboard.data?.games || [];
  const byWins = (a, b) => (b.wins || 0) - (a.wins || 0);
  const confLeaders = (standings.data?.conferences || []).map((c) => {
    const groups = c.groups || [];
    // SWAC football has East/West divisions — show the #1 team from each.
    const teams =
      groups.length > 1
        ? groups.map((g) => [...g.entries].sort(byWins)[0]).filter(Boolean)
        : groups.flatMap((g) => g.entries).sort(byWins).slice(0, 2);
    return { name: c.name, teams };
  });

  return (
    <div className="space-y-10">
      <section>
        <p className="text-sm font-semibold text-brand uppercase tracking-widest">HBCU Surge</p>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight mt-1">{SPORT_LABELS[sport]}</h1>
        <p className="text-muted-foreground mt-2 max-w-xl">
          Live scores, standings, rosters and power rankings for the SWAC &amp; MEAC.
        </p>
      </section>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">This Week</h2>
          <Link to="/scores" className="text-sm text-brand flex items-center gap-1 hover:underline">
            All scores <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        {scoreboard.isLoading ? (
          <p className="text-muted-foreground">Loading games…</p>
        ) : games.length === 0 ? (
          <p className="text-muted-foreground py-8 text-center rounded-xl border border-dashed border-border">
            No {SPORT_LABELS[sport].toLowerCase()} games scheduled this week.
          </p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {games.slice(0, 3).map((g) => (
              <GameCard key={g.id} game={g} />
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Trophy className="w-5 h-5 text-brand" /> Standings Leaders
          </h2>
          <Link to="/standings" className="text-sm text-brand flex items-center gap-1 hover:underline">
            Full standings <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        {standings.isLoading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-6">
            {confLeaders.map((c) => (
              <div key={c.name} className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{c.name}</h3>
                {c.teams.map((t) => (
                  <Link
                    key={t.id}
                    to={`/teams/${t.id}?sport=${sport}&name=${encodeURIComponent(t.name)}&logo=${encodeURIComponent(t.logo || "")}`}
                    className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 hover:border-brand/50 transition"
                  >
                    <TeamLogo src={t.logo} alt={t.name} className="w-10 h-10" />
                    <div className="min-w-0">
                      <p className="font-medium truncate">{t.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {t.record || "—"} · {t.conference}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl bg-sidebar text-sidebar-foreground p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <ListOrdered className="w-6 h-6 text-brand" />
          <div>
            <h3 className="font-semibold">Our Top 6</h3>
            <p className="text-sm text-sidebar-foreground/70">
              The official {SPORT_LABELS[sport].toLowerCase()} top teams, voted by the editors.
            </p>
          </div>
        </div>
        <Link
          to="/my-rankings"
          className="rounded-lg bg-brand text-brand-foreground px-4 py-2 text-sm font-medium hover:opacity-90 transition"
        >
          View rankings
        </Link>
      </section>
    </div>
  );
}