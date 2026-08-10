"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "curio-sidebar-compact";

function applyState(compact: boolean) {
  document.documentElement.dataset.sidebarCompact = compact ? "true" : "false";
}

export function SidebarCollapseButton() {
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY) === "1";
    setCompact(stored);
    applyState(stored);
  }, []);

  function toggle() {
    const next = !compact;
    setCompact(next);
    applyState(next);
    window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
  }

  return (
    <button
      type="button"
      className="sidebar-collapse-button"
      onClick={toggle}
      aria-label={compact ? "Abrir menu lateral" : "Recolher menu lateral"}
      aria-expanded={!compact}
      title={compact ? "Abrir menu" : "Recolher menu"}
    >
      <span aria-hidden="true" />
      <span aria-hidden="true" />
      <span aria-hidden="true" />
    </button>
  );
}
