import type { MetadataRoute } from "next";
import { getSiteOrigin } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteOrigin();
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/legal/"],
      disallow: [
        "/admin/",
        "/professor/",
        "/aluno/",
        "/familia/",
        "/dashboard/",
        "/login/",
        "/primeiro-acesso/",
        "/esqueci-senha/",
        "/definir-senha/",
        "/auth/",
        "/api/",
        "/convite/",
        "/certificados/",
      ],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
