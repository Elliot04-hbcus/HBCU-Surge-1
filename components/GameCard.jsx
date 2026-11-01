import React from "react";
import { Link, useNavigate } from "react-router-dom";
import TeamLogo from "./TeamLogo";
import { useSport } from "./SportContext";
import { cn } from "@/lib/utils";

export default function GameCard({ game }) {
  const { sport } = useSport();
  const navigate = useNavigate();
  if (!game || !game.competitors) return null;
  const away = game.competitors.find((c) => c.homeAway === "away") || game.competitors[0];
  const home = game.competitors.find((c) => c.homeAway === "home") || game.competitors[1];
  const done = game.status?.completed;
  const live = game.status?.state === "in";
  const showScore = done || live;

  const openGame = () => navigate(`/games/${game.id}?sport=${sport}`);
  const stop = (e) => e.stopPropagation();

  const Row = ({ c }) => (
    <div className="flex items-center justify-between">
      <Link
        to={`/teams/${c.id}?sport=${sport}&name=${encodeURIComponent(c.name || "")}&logo=${encodeURIComponent(c.logo || "")}`}
        onClick={stop}
        className="flex items-center gap-3 min-w-0 hover:text-brand transition"
      >
        <TeamLogo src={c.logo} alt={c.name} className="w-8 h-8" />
        <div className="min-w-0">
          <p className={cn("font-medium truncate", c.winner && done && "text-primary")}>{c.name}</p>
          <p className="text-xs text-muted-foreground">
            {c.conference && <span className="text-foreground/60 font-medium">{c.conference}</span>}
            {c.conference && c.record ? " · " : ""}
            {c.record}
          </p>
        </div>
      </Link>
      {showScore ? (
        <span className={cn("text-xl font-bold tabular-nums", c.winner && done && "text-primary")}>{c.score}</span>
      ) : (
        <span className="text-sm text-muted-foreground">—</span>
      )}
    </div>
  );

  return (
    <div
      onClick={openGame}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter") openGame();
      }}
      className="rounded-xl border border-border bg-card p-4 hover:border-brand/40 transition cursor-pointer"
    >
      <div className="flex items-center justify-between text-xs mb-3">
        <span className={cn("font-medium flex items-center gap-1.5", live && "text-brand")}>
          {live && <span className="w-2 h-2 rounded-full bg-brand animate-pulse" />}
          {game.status?.detail || game.status?.shortDetail}
        </span>
        {game.broadcasts?.[0] && <span className="text-muted-foreground">{game.broadcasts.join(", ")}</span>}
      </div>
      <div className="space-y-2.5">
        <Row c={away} />
        <Row c={home} />
      </div>
      {game.venue && (
        <div className="mt-3 pt-3 border-t border-border text-xs text-muted-foreground">
          {game.venue.name}
          {game.venue.city ? `, ${game.venue.city}` : ""}
        </div>
      )}
    </div>
  );
}