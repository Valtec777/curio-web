import type { Metadata } from "next";
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

export default function PresentationLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
