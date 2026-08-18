const LOCAL_ORIGIN = "http://localhost:3000";

function normalizeOrigin(value?: string | null) {
  const raw = String(value || "").trim();
  if (!raw) return null;

  try {
    const url = new URL(raw.includes("://") ? raw : `https://${raw}`);
    const isLocal = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    if (!isLocal && url.protocol !== "https:") return null;
    return url.origin.replace(/\/$/, "");
  } catch {
    return null;
  }
}

function isLocalOrigin(value: string) {
  try {
    const url = new URL(value);
    return url.hostname === "localhost" || url.hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

/**
 * Retorna a origem canônica do Plumareli sem depender de domínios legados.
 *
 * Prioridade:
 * 1. NEXT_PUBLIC_SITE_URL explícita e não local;
 * 2. domínio de produção exposto pela Vercel;
 * 3. URL da branch/deploy da Vercel;
 * 4. NEXT_PUBLIC_SITE_URL local (desenvolvimento/CI);
 * 5. localhost.
 */
export function getSiteOrigin() {
  const configured = normalizeOrigin(process.env.NEXT_PUBLIC_SITE_URL);
  const production = normalizeOrigin(process.env.VERCEL_PROJECT_PRODUCTION_URL);
  const branch = normalizeOrigin(process.env.VERCEL_BRANCH_URL);
  const deployment = normalizeOrigin(process.env.VERCEL_URL);

  if (configured && !isLocalOrigin(configured)) return configured;
  if (production && !isLocalOrigin(production)) return production;
  if (branch && !isLocalOrigin(branch)) return branch;
  if (deployment && !isLocalOrigin(deployment)) return deployment;
  if (configured) return configured;
  return LOCAL_ORIGIN;
}
