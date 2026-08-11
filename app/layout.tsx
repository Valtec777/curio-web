import type { Metadata } from "next";
import { Fredoka, Nunito_Sans } from "next/font/google";
import { ExperiencePreferences } from "@/components/experience-preferences";
import "./globals.css";
import "./responsive.css";
import "./accessibility.css";
import "./urgent-preview-fixes.css";
import "./urgent-fixes.css";
import "./shell-refinements.css";
import "./shell-role-fixes.css";
import "./family-workspace.css";
import "./sidebar-final.css";
import "./brand-slot.css";

const fredoka = Fredoka({
  subsets: ["latin"],
  variable: "--font-curio-display",
  weight: ["500", "600", "700"],
  display: "swap",
});

const nunito = Nunito_Sans({
  subsets: ["latin"],
  variable: "--font-curio-body",
  weight: ["400", "600", "700", "800", "900"],
  display: "swap",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://curioeducacao.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "CURIÓ | Acompanhamento escolar personalizado",
    template: "%s | CURIÓ",
  },
  description: "Acompanhamento escolar personalizado do 1º ano do Ensino Fundamental ao 3º ano do Ensino Médio, com Missões Cuca, Caderno Curió, trilhas extras, preparação para provas e acompanhamento humano.",
  applicationName: "CURIÓ",
  authors: [{ name: "CURIÓ", url: siteUrl }],
  creator: "CURIÓ",
  publisher: "CURIÓ",
  category: "education",
  keywords: [
    "acompanhamento escolar",
    "reforço escolar online",
    "aprendizagem personalizada",
    "apoio escolar",
    "dificuldades de aprendizagem escolar",
    "organização dos estudos",
    "preparação para provas",
    "atividades escolares personalizadas",
    "trilhas de aprendizagem",
    "aprendizagem para crianças e adolescentes",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: "/",
    siteName: "CURIÓ",
    title: "CURIÓ | Acompanhamento escolar que descobre como seu filho aprende",
    description: "Missões personalizadas, atividades no caderno, trilhas extras e acompanhamento humano do 1º ano do Ensino Fundamental ao 3º ano do Ensino Médio.",
  },
  twitter: {
    card: "summary",
    title: "CURIÓ | Acompanhamento escolar personalizado",
    description: "Missões personalizadas, Caderno Curió, trilhas extras e acompanhamento humano do 1º ano do Ensino Fundamental ao 3º ano do Ensino Médio.",
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
        {children}
      </body>
    </html>
  );
}
