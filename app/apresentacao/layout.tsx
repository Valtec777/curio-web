import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import "../design-system.css";
import "../themes.css";
import "../app-shell.css";
import "../presentation-responsive.css";
import "../public-brand.css";
import "../presentation-accessibility.css";
import "../presentation-mascot-fixes.css";

export const metadata: Metadata = {
  title: "PLUMARELI | Apresentação",
  description: "Apresentação reservada do acompanhamento escolar PLUMARELI.",
  robots: {
    index: false,
    follow: false,
    noarchive: true,
    nosnippet: true,
  },
  alternates: { canonical: "/" },
};

export default async function PresentationLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createClient();
  const { data: irara } = await supabase
    .from("characters")
    .select("assets")
    .eq("slug", "irara")
    .maybeSingle();

  const candidate = irara?.assets?.principal || irara?.assets?.avatar || "";
  const iraraUrl = typeof candidate === "string" && candidate.startsWith("https://") ? candidate : "";
  const currentIraraCss = iraraUrl
    ? `
      .hero-mascot-stage .mascot-orbit-main,
      #universo .mascot-character:nth-child(8) .mascot-image-free {
        background-image: url(${JSON.stringify(iraraUrl)}) !important;
        background-repeat: no-repeat !important;
        background-position: center bottom !important;
        background-size: contain !important;
      }

      .hero-mascot-stage .mascot-orbit-main > img,
      #universo .mascot-character:nth-child(8) .mascot-image-free > img {
        opacity: 0 !important;
      }
    `
    : "";

  return (
    <>
      {currentIraraCss ? <style dangerouslySetInnerHTML={{ __html: currentIraraCss }} /> : null}
      {children}
    </>
  );
}
