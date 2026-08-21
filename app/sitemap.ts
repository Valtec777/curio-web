import type { MetadataRoute } from "next";
import { getSiteOrigin } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/server";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteOrigin();
  const entries: MetadataRoute.Sitemap = [
    {
      url: siteUrl,
      changeFrequency: "weekly",
      priority: 1,
    },
  ];

  try {
    const supabase = await createClient();
    const { data: documents } = await supabase
      .from("legal_documents")
      .select("public_slug,published_at,updated_at")
      .eq("status", "published")
      .eq("is_current", true)
      .order("public_slug");

    for (const document of documents ?? []) {
      if (!document.public_slug) continue;
      entries.push({
        url: `${siteUrl}/legal/${encodeURIComponent(document.public_slug)}`,
        lastModified: document.updated_at || document.published_at || undefined,
        changeFrequency: "monthly",
        priority: 0.4,
      });
    }
  } catch {
    // Se o banco estiver temporariamente indisponível, preserve ao menos a landing no sitemap.
  }

  return entries;
}
