import type { MetadataRoute } from "next";
import { getSiteOrigin } from "@/lib/site-url";

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteOrigin();
  const now = new Date();
  return [
    { url: siteUrl, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${siteUrl}/legal/termos-de-uso`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    { url: `${siteUrl}/legal/privacidade-da-crianca`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
  ];
}
