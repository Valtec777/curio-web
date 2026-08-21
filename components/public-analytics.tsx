"use client";

import { useEffect } from "react";

type PublicEventName = "landing_view" | "lead_cta_click" | "lead_form_submit" | "lead_success" | "login_click";

function isPublicLandingPath(pathname: string) {
  return pathname === "/" || pathname.startsWith("/convite/");
}

function placementFor(element: Element) {
  const section = element.closest("section[id]");
  if (section?.id) return section.id.slice(0, 40);
  if (element.closest("header")) return "header";
  if (element.closest("footer")) return "footer";
  return "page";
}

function emitPublicEvent(name: PublicEventName, placement?: string) {
  if (typeof window === "undefined" || !isPublicLandingPath(window.location.pathname)) return;

  const payload = JSON.stringify({
    name,
    path: window.location.pathname,
    ...(placement ? { placement } : {}),
  });

  if (navigator.sendBeacon) {
    navigator.sendBeacon("/api/public-events", new Blob([payload], { type: "application/json" }));
    return;
  }

  void fetch("/api/public-events", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: payload,
    keepalive: true,
    credentials: "omit",
  });
}

export function PublicAnalytics() {
  useEffect(() => {
    if (!isPublicLandingPath(window.location.pathname)) return;

    emitPublicEvent("landing_view");
    if (new URLSearchParams(window.location.search).get("lead") === "sucesso") {
      emitPublicEvent("lead_success", "quero-conhecer");
    }

    const onClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href") || "";

      if (href.includes("#quero-conhecer")) {
        emitPublicEvent("lead_cta_click", placementFor(anchor));
      } else if (href === "/login" || href.endsWith("/login")) {
        emitPublicEvent("login_click", placementFor(anchor));
      }
    };

    const onSubmit = (event: Event) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;
      if (!form.querySelector('[name="guardian_name"]') || !form.querySelector('[name="consent_contact"]')) return;
      emitPublicEvent("lead_form_submit", placementFor(form));
    };

    document.addEventListener("click", onClick, { passive: true });
    document.addEventListener("submit", onSubmit);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("submit", onSubmit);
    };
  }, []);

  return null;
}
