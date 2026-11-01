import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useSport, SPORT_LABELS } from "@/components/SportContext";
import TeamLogo from "@/components/TeamLogo";
import PullToRefresh from "@/components/PullToRefresh";

function StreakBadge({ streak }) {
  if (!streak) return <span className="text-muted-foreground">—</span>;
  const m = streak.match(/^([WL])(\d+)$/);
  if (!m) return <span className="text-muted-foreground">{streak}</span>;
  const [, type, n] = m;
  const win = type === "W";
  return (
    <span
      className={`inline-flex items-center justify-center min-w-[28px] px-1.5 py-0.5 rounded-full text-[10px] font-bold tabular-nums ${
        win ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400" : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"
      }`}
    >
      {n}{type}
    </span>
  );
}

export default function Standings() {
  const { sport } = useSport();
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["standings", sport],
    queryFn: () => base44.functions.invoke("getHbcuStandings", { sport }).then((r) => r.data),
  });

  if (isLoading) return <p className="text-muted-foreground">Loading standings…</p>;
  const conferences = data?.conferences || [];
  if (!conferences.length) return <p className="text-muted-foreground">No standings available.</p>;

  return (
    <PullToRefresh onRefresh={refetch}>
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">{SPORT_LABELS[sport]} Standings</h1>
        <p className="text-muted-foreground text-sm">{data?.season ? `${data.season} Season · ` : ""}SWAC & MEAC</p>
      </div>
      {conferences.map((conf) => (
        <div key={conf.shortName} className="space-y-4">
          <h2 className="text-lg font-semibold">{conf.name}</h2>
          {(conf.groups || []).map((g) => (
            <div key={g.shortName} className="rounded-xl border border-border overflow-hidden bg-card">
              {conf.groups.length > 1 && (
                <div className="px-4 py-2 bg-muted text-sm font-medium">{g.name}</div>
              )}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground bg-muted/40">
                    <tr>
                      <th className="text-left px-4 py-2 font-medium">Team</th>
                      <th className="text-center px-2 py-2 font-medium">Conf</th>
                      <th className="text-center px-2 py-2 font-medium">W</th>
                      <th className="text-center px-2 py-2 font-medium">L</th>
                      <th className="text-center px-2 py-2 font-medium hidden sm:table-cell">PF</th>
                      <th className="text-center px-2 py-2 font-medium hidden sm:table-cell">PA</th>
                      <th className="text-center px-4 py-2 font-medium">STRK</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.entries.map((t, i) => (
                      <tr key={t.id} className="border-t border-border hover:bg-muted/40 transition">
                        <td className="px-4 py-2.5">
                          <Link
                            to={`/teams/${t.id}?sport=${sport}&name=${encodeURIComponent(t.name)}&logo=${encodeURIComponent(t.logo || "")}`}
                            className="flex items-center gap-3 hover:text-brand"
                          >
                            <span className="text-muted-foreground text-xs w-4 tabular-nums">{i + 1}</span>
                            <TeamLogo src={t.logo} alt={t.name} className="w-6 h-6" />
                            <span className="font-medium">{t.name}</span>
                          </Link>
                        </td>
                        <td className="text-center px-2 py-2.5 tabular-nums text-muted-foreground">{t.confRecord ?? "—"}</td>
                        <td className="text-center px-2 py-2.5 tabular-nums">{t.wins ?? "—"}</td>
                        <td className="text-center px-2 py-2.5 tabular-nums">{t.losses ?? "—"}</td>
                        <td className="text-center px-2 py-2.5 tabular-nums hidden sm:table-cell">
                          {t.pointsFor ?? "—"}
                        </td>
                        <td className="text-center px-2 py-2.5 tabular-nums hidden sm:table-cell">
                          {t.pointsAgainst ?? "—"}
                        </td>
                        <td className="text-center px-4 py-2.5"><StreakBadge streak={t.streak} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
    </PullToRefresh>
  );
}