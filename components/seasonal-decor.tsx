"use client";

import { useEffect } from "react";
import { getSeasonalEvent } from "@/lib/seasonal";

export function SeasonalDecor() {
  useEffect(() => {
    const refresh = () => {
      const nextEvent = getSeasonalEvent(new Date());
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

  // A data sazonal continua disponível para temas e missões especiais, mas a
  // interface não injeta mais emojis flutuantes sobre as páginas.
  return null;
}
