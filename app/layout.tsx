import { Suspense } from "react";
import type { Metadata, Viewport } from "next";
import { Fredoka, Nunito_Sans } from "next/font/google";
import { ExperiencePreferences } from "@/components/experience-preferences";
import { PublicAnalytics } from "@/components/public-analytics";
import { ReferralTeacherPrefill } from "@/components/referral-teacher-prefill";
import { BRAND_LOGO_ENDPOINT } from "@/lib/brand-assets";
import { getSiteOrigin } from "@/lib/site-url";
import "./globals.css";
import "./design-system.css";
import "./themes.css";
import "./app-shell.css";
import "./brand-slot.css";
import "./responsive.css";
import "./public-brand.css";
import "./accessibility.css";
import "./onboarding-launcher-compact.css";

const fredoka = Fredoka({ subsets: ["latin"], variable: "--font-curio-display", weight: ["500", "600", "700"], display: "swap" });
const nunito = Nunito_Sans({ subsets: ["latin"], variable: "--font-curio-body", weight: ["400", "600", "700", "800", "900"], display: "swap" });
const siteUrl = getSiteOrigin();
const officialLogo = BRAND_LOGO_ENDPOINT;
const socialDescription = "Acompanhamento escolar online com missões, Caderno Plumareli, preparação para provas e acompanhamento humano do 1º ano do Ensino Fundamental ao 3º ano do Ensino Médio.";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "PLUMARELI | Acompanhamento escolar online personalizado", template: "%s | PLUMARELI" },
  description: "Acompanhamento escolar online do 1º ano do Ensino Fundamental ao 3º ano do Ensino Médio, com missões, atividades no caderno, preparação para provas e acompanhamento humano.",
  applicationName: "PLUMARELI",
  authors: [{ name: "PLUMARELI", url: siteUrl }],
  creator: "PLUMARELI",
  publisher: "PLUMARELI",
  category: "education",
  keywords: [
    "acompanhamento escolar",
    "acompanhamento escolar online",
    "reforço escolar online",
    "aprendizagem personalizada",
    "apoio escolar",
    "organização dos estudos",
    "preparação para provas",
    "atividades escolares personalizadas",
    "aprendizagem para crianças e adolescentes",
  ],
  alternates: { canonical: "/" },
  icons: {
    icon: officialLogo,
    shortcut: officialLogo,
    apple: officialLogo,
  },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: "/",
    siteName: "PLUMARELI",
    title: "PLUMARELI | Organize os estudos e avance com clareza",
    description: socialDescription,
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "PLUMARELI — acompanhamento escolar online com clareza e acompanhamento humano",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "PLUMARELI | Acompanhamento escolar online personalizado",
    description: "Organize a rotina de estudos com missões, atividades no caderno, preparação para provas e acompanhamento humano.",
    images: ["/twitter-image"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${fredoka.variable} ${nunito.variable}`} suppressHydrationWarning>
      <body>
        <ExperiencePreferences />
        <Suspense fallback={null}><ReferralTeacherPrefill /></Suspense>
        {children}
        <PublicAnalytics />
      </body>
    </html>
  );
}
