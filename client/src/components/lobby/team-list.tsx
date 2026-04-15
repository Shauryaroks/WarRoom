"use client";

import { useEffect, useRef, useState } from "react";

interface Team {
  id: string;
  name: string;
  ticker: string;
}

interface TeamListProps {
  teams: Team[];
}

function TeamRow({ team, animate }: { team: Team; animate: boolean }) {
  const [visible, setVisible] = useState(!animate);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (animate) {
      // Trigger animation on next frame
      requestAnimationFrame(() => setVisible(true));
    }
  }, [animate]);

  return (
    <div
      ref={ref}
      className="flex items-center gap-2 py-2 border-b border-border transition-all duration-200 ease-out"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(-8px)",
      }}
    >
      <span className="font-mono font-bold text-sm text-primary">
        {team.ticker}
      </span>
      <span className="text-sm text-foreground">{team.name}</span>
    </div>
  );
}

export function TeamList({ teams }: TeamListProps) {
  const prevCountRef = useRef(0);

  useEffect(() => {
    prevCountRef.current = teams.length;
  }, [teams.length]);

  if (teams.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-muted-foreground">No teams approved yet</p>
        <p className="text-xs text-muted-foreground mt-1">
          Teams will appear here once the admin approves registrations.
        </p>
      </div>
    );
  }

  return (
    <div>
      {teams.map((team, index) => (
        <TeamRow
          key={team.id}
          team={team}
          animate={index >= prevCountRef.current}
        />
      ))}
    </div>
  );
}
