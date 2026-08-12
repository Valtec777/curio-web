"use client";

import { useEffect, useRef } from "react";
import { useCurioSounds } from "@/components/use-curio-sounds";

export function StudentAchievementSound({
  viewerId,
  count,
}: {
  viewerId: string;
  count: number;
}) {
  const { play } = useCurioSounds(viewerId);
  const playedRef = useRef(false);

  useEffect(() => {
    if (count <= 0 || playedRef.current) return;
    playedRef.current = true;
    const timer = window.setTimeout(() => play("achievement"), 180);
    return () => window.clearTimeout(timer);
  }, [count, play]);

  if (count <= 0) return null;

  return (
    <span className="sr-only" aria-live="polite">
      {count === 1 ? "Você desbloqueou uma nova conquista." : `Você desbloqueou ${count} novas conquistas.`}
    </span>
  );
}
