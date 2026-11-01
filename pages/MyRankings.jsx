import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useSport, SPORT_LABELS } from "@/components/SportContext";
import TeamLogo from "@/components/TeamLogo";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { Trash2, Pencil, Plus, X, Trophy, GripVertical } from "lucide-react";
import ShareRankings from "@/components/ShareRankings";
import PlayerRankingsTab from "@/components/PlayerRankingsTab";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

export default function MyRankings() {
  const { sport } = useSport();
  const qc = useQueryClient();
  const [teamId, setTeamId] = useState("");
  const [rank, setRank] = useState("");
  const [notes, setNotes] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editRank, setEditRank] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [tab, setTab] = useState("teams");

  const me = useQuery({ queryKey: ["me"], queryFn: () => base44.auth.me() });
  const isAdmin = me.data?.role === "admin";

  const rankings = useQuery({
    queryKey: ["powerrankings", sport],
    queryFn: () =>
      base44.entities.MyRanking.filter({ sport }, { sort: "rank", limit: 100 }).then((r) => r.items || []),
  });
  const teams = useQuery({
    queryKey: ["standings", sport],
    queryFn: () => base44.functions.invoke("getHbcuStandings", { sport }).then((r) => r.data),
  });
  const playerRankings = useQuery({
    queryKey: ["playerrankings", sport],
    queryFn: () =>
      base44.entities.MyPlayerRanking.filter({ sport }, { sort: "rank", limit: 100 }).then((r) => r.items || []),
  });

  const list = rankings.data || [];
  const playerList = playerRankings.data || [];
  const rankedIds = new Set(list.map((x) => x.team_id));
  const available = (teams.data?.teams || []).filter((t) => t.id && !rankedIds.has(t.id));

  // Overall W-L record per team from standings data.
  const recordById = useMemo(() => {
    const m = {};
    (teams.data?.teams || []).forEach((t) => {
      if (t.id) m[t.id] = t.record || "";
    });
    return m;
  }, [teams.data]);

  async function addRanking(e) {
    e.preventDefault();
    const team = (teams.data?.teams || []).find((t) => t.id === teamId);
    if (!team) return;
    const nextRank = rank ? Number(rank) : list.length + 1;
    await base44.entities.MyRanking.create({
      sport,
      team_id: team.id,
      team_name: team.name,
      team_logo: team.logo || "",
      rank: nextRank,
      notes,
    });
    setTeamId("");
    setRank("");
    setNotes("");
    qc.invalidateQueries({ queryKey: ["powerrankings", sport] });
  }

  async function saveEdit(id) {
    await base44.entities.MyRanking.update(id, { rank: Number(editRank), notes: editNotes });
    setEditingId(null);
    qc.invalidateQueries({ queryKey: ["powerrankings", sport] });
  }

  async function remove(id) {
    await base44.entities.MyRanking.delete(id);
    qc.invalidateQueries({ queryKey: ["powerrankings", sport] });
  }

  async function onDragEnd(result) {
    if (!result.destination || result.destination.index === result.source.index) return;
    const reordered = [...list];
    const [moved] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, moved);
    const updates = reordered.map((r, i) => ({ id: r.id, rank: i + 1 }));
    await base44.entities.MyRanking.bulkUpdate(updates);
    qc.invalidateQueries({ queryKey: ["powerrankings", sport] });
  }

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Trophy className="w-6 h-6 text-brand" />
            Our Top 6 {tab === "teams" ? "Teams" : "Players"}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {teams.data?.season ? `${teams.data.season} Season · ` : ""}
            {tab === "teams"
              ? "The definitive top teams across the SWAC & MEAC."
              : "The standout athletes across the SWAC & MEAC."}
          </p>
        </div>
        {tab === "teams" && list.length > 0 && <ShareRankings list={list} sportLabel={SPORT_LABELS[sport]} type="teams" />}
        {tab === "players" && playerList.length > 0 && (
          <ShareRankings list={playerList} sportLabel={SPORT_LABELS[sport]} type="players" />
        )}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="teams">Teams</TabsTrigger>
          <TabsTrigger value="players">Players</TabsTrigger>
        </TabsList>

        <TabsContent value="teams" className="space-y-6 mt-4">
      {isAdmin && (
        <form onSubmit={addRanking} className="rounded-xl border border-border bg-card p-4 space-y-3">
          <h2 className="font-semibold">Add a team</h2>
          <div className="grid sm:grid-cols-3 gap-3">
            <Select value={teamId} onValueChange={setTeamId}>
              <SelectTrigger className="sm:col-span-2">
                <SelectValue placeholder="Select a team…" />
              </SelectTrigger>
              <SelectContent>
                {available.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input
              type="number"
              min="1"
              value={rank}
              onChange={(e) => setRank(e.target.value)}
              placeholder={`Rank (default ${list.length + 1})`}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes (optional)"
            rows="2"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90 transition"
          >
            <Plus className="w-4 h-4" /> Add to rankings
          </button>
        </form>
      )}

        {rankings.isLoading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : list.length === 0 ? (
          <p className="text-muted-foreground py-12 text-center rounded-xl border border-dashed border-border">
            No power rankings published yet{isAdmin ? ". Add your first team above." : "."}
          </p>
        ) : isAdmin ? (
          <DragDropContext onDragEnd={onDragEnd}>
            <Droppable droppableId="rankings">
              {(provided) => (
                <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-2">
                  {list.map((r, index) => (
                    <Draggable draggableId={r.id} index={index} key={r.id}>
                      {(prov) => (
                        <div
                          ref={prov.innerRef}
                          {...prov.draggableProps}
                          className="flex items-center gap-3 rounded-xl border border-border bg-card p-3"
                        >
                          {editingId === r.id ? (
                            <>
                              <input
                                type="number"
                                min="1"
                                value={editRank}
                                onChange={(e) => setEditRank(e.target.value)}
                                className="w-16 rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
                              />
                              <TeamLogo src={r.team_logo} alt={r.team_name} className="w-8 h-8" />
                              <input
                                value={editNotes}
                                onChange={(e) => setEditNotes(e.target.value)}
                                placeholder="Notes"
                                className="flex-1 rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
                              />
                              <button onClick={() => saveEdit(r.id)} className="text-sm font-medium text-brand">
                                Save
                              </button>
                              <button onClick={() => setEditingId(null)} className="p-1 text-muted-foreground">
                                <X className="w-4 h-4" />
                              </button>
                            </>
                          ) : (
                            <>
                              <span
                                {...prov.dragHandleProps}
                                className="cursor-grab active:cursor-grabbing text-muted-foreground/50 hover:text-muted-foreground"
                              >
                                <GripVertical className="w-5 h-5" />
                              </span>
                              <span className="w-8 text-center font-bold text-lg text-brand tabular-nums">{r.rank}</span>
                              <Link
                                to={`/teams/${r.team_id}?sport=${sport}&name=${encodeURIComponent(r.team_name)}&logo=${encodeURIComponent(r.team_logo || "")}`}
                                className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-80 transition"
                              >
                                <TeamLogo src={r.team_logo} alt={r.team_name} className="w-8 h-8" />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-baseline gap-2">
                                    <p className="font-medium truncate">{r.team_name}</p>
                                    {recordById[r.team_id] && (
                                      <span className="text-xs text-muted-foreground shrink-0 tabular-nums">{recordById[r.team_id]}</span>
                                    )}
                                  </div>
                                  {r.notes && <p className="text-xs text-muted-foreground truncate">{r.notes}</p>}
                                </div>
                              </Link>
                              {isAdmin && (
                                <>
                                  <button
                                    onClick={() => {
                                      setEditingId(r.id);
                                      setEditRank(String(r.rank));
                                      setEditNotes(r.notes || "");
                                    }}
                                    className="p-1.5 text-muted-foreground hover:text-foreground"
                                    aria-label="Edit"
                                  >
                                    <Pencil className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => remove(r.id)}
                                    className="p-1.5 text-muted-foreground hover:text-destructive"
                                    aria-label="Delete"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        ) : (
          <div className="space-y-2">
            {list.map((r) => (
              <div key={r.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
                <span className="w-8 text-center font-bold text-lg text-brand tabular-nums">{r.rank}</span>
                <Link
                  to={`/teams/${r.team_id}?sport=${sport}&name=${encodeURIComponent(r.team_name)}&logo=${encodeURIComponent(r.team_logo || "")}`}
                  className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-80 transition"
                >
                  <TeamLogo src={r.team_logo} alt={r.team_name} className="w-8 h-8" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <p className="font-medium truncate">{r.team_name}</p>
                      {recordById[r.team_id] && (
                        <span className="text-xs text-muted-foreground shrink-0 tabular-nums">{recordById[r.team_id]}</span>
                      )}
                    </div>
                    {r.notes && <p className="text-xs text-muted-foreground truncate">{r.notes}</p>}
                  </div>
                </Link>
              </div>
            ))}
          </div>
        )}
        </TabsContent>

        <TabsContent value="players" className="mt-4">
          <PlayerRankingsTab isAdmin={isAdmin} />
        </TabsContent>
      </Tabs>
    </div>
  );
}