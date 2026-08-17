/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return {
      beforeFiles: [],
      afterFiles: [],
      fallback: [
        {
          source: "/brand/plumareli-primary-20260816.webp",
          destination: "/brand/plumareli-wordmark-20260816.webp",
        },
        {
          source: "/mascotes/plumareli_mico_leao_dourado_principal.webp",
          destination: "/mascotes/curio_mico_principal_praticando.png",
        },
      ],
    };
  },
};

export default nextConfig;
