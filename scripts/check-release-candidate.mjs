import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), "utf8");

const pkg = JSON.parse(read("package.json"));
const trust = read("components/public-trust-section.tsx");
const actions = read("app/actions.ts");
const supabaseServer = read("lib/supabase/server.ts");
const layout = read("app/layout.tsx");
const nextConfig = read("next.config.mjs");
const robots = read("app/robots.ts");
const sitemap = read("app/sitemap.ts");

const requiredScripts = [
  "css:check",
  "responsive:check",
  "color:check",
  "security:check",
  "performance:check",
  "discoverability:check",
  "dependencies:check",
  "typecheck",
  "build",
];

for (const script of requiredScripts) {
  if (!pkg.scripts?.[script]) {
    console.error(`Release candidate: script obrigatório ausente: ${script}`);
    process.exit(1);
  }
}

for (const marker of [
  "Por dentro do Plumareli",
  "Portal do Aluno",
  "Ninho da Família",
  "Meu Caminho",
  "dados ilustrativos",
]) {
  if (!trust.includes(marker)) {
    console.error(`Release candidate: prévia da Etapa 3 ausente: ${marker}`);
    process.exit(1);
  }
}

for (const marker of [
  "z.enum(PUBLIC_GRADES)",
  "child_name: null",
  "child_age: null",
  "subjects: []",
  "main_difficulties: null",
]) {
  if (!actions.includes(marker)) {
    console.error(`Release candidate: minimização do lead ausente: ${marker}`);
    process.exit(1);
  }
}

for (const marker of [
  "PUBLIC_CONTENT_CACHE_SECONDS = 300",
  "hasAuthenticatedSession",
  'cache: "force-cache"',
]) {
  if (!supabaseServer.includes(marker)) {
    console.error(`Release candidate: contrato de cache ausente: ${marker}`);
    process.exit(1);
  }
}

for (const marker of ["<PublicAnalytics />", "socialImage", 'locale: "pt_BR"']) {
  if (!layout.includes(marker)) {
    console.error(`Release candidate: descoberta/analytics ausente: ${marker}`);
    process.exit(1);
  }
}

for (const marker of ["Content-Security-Policy", "X-Frame-Options", "DENY"]) {
  if (!nextConfig.includes(marker)) {
    console.error(`Release candidate: header de segurança ausente: ${marker}`);
    process.exit(1);
  }
}

for (const path of ["/admin/", "/professor/", "/aluno/", "/familia/", "/api/"]) {
  if (!robots.includes(`"${path}"`)) {
    console.error(`Release candidate: robots não protege ${path}`);
    process.exit(1);
  }
}

for (const slug of ["politica-de-privacidade", "privacidade-da-crianca"]) {
  if (!sitemap.includes(slug)) {
    console.error(`Release candidate: sitemap sem ${slug}`);
    process.exit(1);
  }
}

const floating = Object.entries({ ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) })
  .filter(([, version]) => /^(latest|next|canary|beta|rc)$|^[~^]/i.test(String(version)));
if (floating.length) {
  console.error(`Release candidate: dependências flutuantes: ${floating.map(([name]) => name).join(", ")}`);
  process.exit(1);
}

console.log("Release candidate OK: etapas 1–7 integradas no contrato público e de build.");
