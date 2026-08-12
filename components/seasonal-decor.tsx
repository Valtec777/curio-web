"use client";

import { useEffect, useState } from "react";
import { getSeasonalEvent, type SeasonalEvent } from "@/lib/seasonal";

export function SeasonalDecor() {
  const [event, setEvent] = useState<SeasonalEvent | null>(null);

  useEffect(() => {
    const refresh = () => {
      const nextEvent = getSeasonalEvent(new Date());
      setEvent(nextEvent);
      if (nextEvent) document.documentElement.dataset.curioSeason = nextEvent.slug;
      else delete document.documentElement.dataset.curioSeason;
    };

    refresh();
    const timer = window.setInterval(refresh, 60 * 60 * 1000);
    return () => {
      window.clearInterval(timer);
      delete document.documentElement.dataset.curioSeason;
    };
  }, []);

  if (!event) return null;

  return (
    <div className="seasonal-decor-layer" aria-hidden="true">
      {event.decorations.map((decoration, index) => (
        <span className="seasonal-decor-chip" key={`${event.slug}-${index}`}>{decoration}</span>
      ))}
    </div>
  );
}
