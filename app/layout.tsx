import { Suspense } from "react";
import type { Metadata, Viewport } from "next";
import { Fredoka, Nunito_Sans } from "next/font/google";
import { ExperiencePreferences } from "@/components/experience-preferences";
import { ReferralTeacherPrefill } from "@/components/referral-teacher-prefill";
import { SeasonalDecor } from "@/components/seasonal-decor";
import "./globals.css";
import "./responsive.css";
import "./accessibility.css";
import "./urgent-preview-fixes.css";
import "./urgent-fixes.css";
import "./shell-refinements.css";
import "./shell-role-fixes.css";
import "./family-workspace.css";
import "./family-mobile-selector.css";
import "./sidebar-final.css";
import "./brand-slot.css";
import "./site-polish.css";
import "./final-polish.css";
import "./referrals.css";
import "./mobile-tablet-final.css";
import "./mobile-tablet-complete.css";
import "./mobile-targeted-fixes.css";
import "./dark-mode-safety.css";
import "./onboarding-launcher-compact.css";
import "./seasonal.css";

const fredoka = Fredoka({ subsets: ["latin"], variable: "--font-curio-display", weight: ["500", "600", "700"], display: "swap" });
const nunito = Nunito_Sans({ subsets: ["latin"], variable: "--font-curio-body", weight: ["400", "600", "700", "800", "900"], display: "swap" });
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://curioeducacao.vercel.app";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "PLUMARELI | Acompanhamento escolar personalizado", template: "%s | PLUMARELI" },
  description: "Acompanhamento escolar personalizado do 1º ano do Ensino Fundamental ao 3º ano do Ensino Médio, com Missões Cuca, Caderno Plumareli, trilhas extras, preparação para provas e acompanhamento humano.",
  applicationName: "PLUMARELI",
  authors: [{ name: "PLUMARELI", url: siteUrl }], creator: "PLUMARELI", publisher: "PLUMARELI", category: "education",
  keywords: ["acompanhamento escolar", "reforço escolar online", "aprendizagem personalizada", "apoio escolar", "dificuldades de aprendizagem escolar", "organização dos estudos", "preparação para provas", "atividades escolares personalizadas", "trilhas de aprendizagem", "aprendizagem para crianças e adolescentes"],
  alternates: { canonical: "/" },
  icons: {
    icon: "/brand/plumareli-symbol.webp",
    shortcut: "/brand/plumareli-symbol.webp",
    apple: "/brand/plumareli-symbol.webp",
  },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: "/",
    siteName: "PLUMARELI",
    title: "PLUMARELI | Acompanhamento escolar que descobre como seu filho aprende",
    description: "Missões personalizadas, atividades no caderno, trilhas extras e acompanhamento humano do 1º ano do Ensino Fundamental ao 3º ano do Ensino Médio.",
    images: [{ url: "/brand/plumareli-primary.webp", width: 1400, height: 811, alt: "Plumareli" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "PLUMARELI | Acompanhamento escolar personalizado",
    description: "Missões personalizadas, Caderno Plumareli, trilhas extras e acompanhamento humano do 1º ano do Ensino Fundamental ao 3º ano do Ensino Médio.",
    images: ["/brand/plumareli-primary.webp"],
  },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 } },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${fredoka.variable} ${nunito.variable}`} suppressHydrationWarning>
      <body>
        <ExperiencePreferences />
        <SeasonalDecor />
        <Suspense fallback={null}><ReferralTeacherPrefill /></Suspense>
        {children}
      </body>
    </html>
  );
}
