/** @type {import('next').NextConfig} */
const supabaseRemotePatterns = [];
try {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    const supabaseUrl = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);
    supabaseRemotePatterns.push({
      protocol: supabaseUrl.protocol === "http:" ? "http" : "https",
      hostname: supabaseUrl.hostname,
      pathname: "/storage/v1/object/public/**",
    });
  }
} catch {
  // A configuração inválida será percebida pelo cliente Supabase; não bloqueie o build por isso.
}

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: "base-uri 'self'; frame-ancestors 'self'; form-action 'self'; object-src 'none'",
  },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
  { key: "Permissions-Policy", value: "geolocation=(), browsing-topics=()" },
];

const nextConfig = {
  images: {
    remotePatterns: supabaseRemotePatterns,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
  async rewrites() {
    return {
      beforeFiles: [],
      afterFiles: [],
      fallback: [
        // Compatibilidade com caminhos de marca que antes eram materializados no prebuild.
        // Como são rewrites de fallback, um arquivo real com esse nome sempre tem prioridade.
        {
          source: "/brand/plumareli-symbol.webp",
          destination: "/brand/plumareli-logo-oficial.webp",
        },
        {
          source: "/brand/plumareli-wordmark.webp",
          destination: "/brand/plumareli-wordmark-20260816.webp",
        },
        {
          source: "/brand/plumareli-primary.webp",
          destination: "/brand/plumareli-logo-oficial.webp",
        },
        {
          source: "/brand/plumareli-primary-20260816.webp",
          destination: "/brand/plumareli-logo-oficial.webp",
        },
        {
          source: "/brand/plumareli-negative.webp",
          destination: "/brand/plumareli-negative-20260816.webp",
        },
        // Mascotes: nunca deixar uma imagem quebrada quando o WebP gerado não existir.
        {
          source: "/mascotes/plumareli_mico_leao_dourado_principal.webp",
          destination: "/mascotes/curio_mico_principal_praticando.png",
        },
        {
          source: "/mascotes/plumareli_mico_leao_dourado_20260816.webp",
          destination: "/mascotes/curio_mico_principal_praticando.png",
        },
        {
          source: "/mascotes/plumareli_irara_principal.webp",
          destination: "/mascotes/curio_arara_principal_saudando.png",
        },
        {
          source: "/mascotes/plumareli_harpia_principal.webp",
          destination: "/mascotes/curio_harpia_principal_conquista_voando.png",
        },
      ],
    };
  },
};

export default nextConfig;
