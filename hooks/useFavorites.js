import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

export function useFavorites(sport) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["favorites", sport],
    queryFn: () =>
      base44.entities.FavoriteTeam.filter({ sport }, { sort: "-created_date", limit: 100 }).then(
        (r) => r.items || []
      ),
  });

  const records = query.data || [];
  const favIds = new Set(records.map((r) => String(r.team_id)));

  async function toggleFavorite(team) {
    const key = ["favorites", sport];
    const prev = qc.getQueryData(key) || [];
    const idStr = String(team.id);
    const existing = prev.find((r) => String(r.team_id) === idStr);

    // Optimistic update for immediate feedback.
    if (existing) {
      qc.setQueryData(key, prev.filter((r) => String(r.team_id) !== idStr));
    } else {
      const temp = {
        id: `temp-${Date.now()}`,
        team_id: idStr,
        team_name: team.name,
        team_logo: team.logo || "",
        sport,
        created_date: new Date().toISOString(),
      };
      qc.setQueryData(key, [temp, ...prev]);
    }

    try {
      const fresh = await base44.entities.FavoriteTeam
        .filter({ sport, team_id: idStr }, { limit: 10 })
        .then((r) => r.items || [])
        .catch(() => []);
      if (fresh.length > 0) {
        await base44.entities.FavoriteTeam.delete(fresh[0].id);
      } else {
        await base44.entities.FavoriteTeam.create({
          sport,
          team_id: idStr,
          team_name: team.name,
          team_logo: team.logo || "",
        });
      }
    } catch (e) {
      // Revert on failure.
      qc.setQueryData(key, prev);
      throw e;
    }
    qc.invalidateQueries({ queryKey: key });
  }

  return { ...query, favIds, toggleFavorite };
}