import type { Metadata } from "next";
import { Fredoka, Nunito_Sans } from "next/font/google";
import { ExperiencePreferences } from "@/components/experience-preferences";
import "./globals.css";
import "./responsive.css";

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

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "CURIÓ | Acompanhamento escolar personalizado",
    template: "%s | CURIÓ",
  },
  description: "Acompanhamento escolar personalizado para estudantes do 1º ao 8º ano, com Missões Cuca, Caderno Curió, cursos livres, preparação para provas e acompanhamento humano.",
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
    "cursos livres para crianças",
    "cursos livres para adolescentes",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: "/",
    siteName: "CURIÓ",
    title: "CURIÓ | Acompanhamento escolar que descobre como seu filho aprende",
    description: "Missões personalizadas, atividades no caderno, cursos livres e acompanhamento humano do 1º ao 8º ano.",
    images: [
      {
        url: "/mascotes/curio_capivara_principal_acolhendo.png",
        width: 1200,
        height: 630,
        alt: "CURIÓ — acompanhamento escolar personalizado",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "CURIÓ | Acompanhamento escolar personalizado",
    description: "Missões personalizadas, Caderno Curió, cursos livres e acompanhamento humano do 1º ao 8º ano.",
    images: ["/mascotes/curio_capivara_principal_acolhendo.png"],
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
