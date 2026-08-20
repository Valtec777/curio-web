import type { MetadataRoute } from "next";
import { getSiteOrigin } from "@/lib/site-url";

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteOrigin();
  return [
    { url: siteUrl },
    { url: `${siteUrl}/legal/termos-de-uso` },
    { url: `${siteUrl}/legal/politica-de-privacidade` },
    { url: `${siteUrl}/legal/privacidade-da-crianca` },
  ];
}
