import type { MetadataRoute } from "next";

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: siteUrl, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${siteUrl}/legal/termos-de-uso`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    { url: `${siteUrl}/legal/privacidade-da-crianca`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
  ];
}
