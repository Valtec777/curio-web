import type { MetadataRoute } from "next";
import { isPrivateBetaEnabled } from "@/lib/public-launch";
import { getSiteOrigin } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteOrigin();

  if (isPrivateBetaEnabled()) {
    return {
      rules: {
        userAgent: "*",
        disallow: "/",
      },
      host: siteUrl,
    };
  }

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
        "/convite/",
      ],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
