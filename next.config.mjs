/** @type {import('next').NextConfig} */
const nextConfig = {
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
