import type { Metadata } from "next";
import Home from "@/app/page";

export const metadata: Metadata = {
  title: "PLUMARELI | Apresentação",
  description: "Apresentação reservada do acompanhamento escolar PLUMARELI.",
  robots: { index: false, follow: false, noarchive: true, nosnippet: true },
  alternates: { canonical: "/" },
};

export default async function PresentationPage({
  searchParams,
}: {
  searchParams: Promise<{ lead?: string }>;
}) {
  return <Home searchParams={searchParams} />;
}
