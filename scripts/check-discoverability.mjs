import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const layout = readFileSync(resolve(root, "app/layout.tsx"), "utf8");
const robots = readFileSync(resolve(root, "app/robots.ts"), "utf8");
const sitemap = readFileSync(resolve(root, "app/sitemap.ts"), "utf8");
const publicAnalytics = readFileSync(resolve(root, "components/public-analytics.tsx"), "utf8");
const publicEvents = readFileSync(resolve(root, "app/api/public-events/route.ts"), "utf8");
const socialAsset = resolve(root, "public/brand/plumareli-logo-oficial.webp");

const requiredLayout = [
  'const socialImage = "/brand/plumareli-logo-oficial.webp"',
  "url: socialImage",
  "images: [socialImage]",
  "<PublicAnalytics />",
  'locale: "pt_BR"',
  'alternates: { canonical: "/" }',
];

for (const fragment of requiredLayout) {
  if (!layout.includes(fragment)) {
    console.error(`Discoverability baseline: layout missing ${fragment}`);
    process.exit(1);
  }
}

if (!existsSync(socialAsset)) {
  console.error("Discoverability baseline: static social image is missing.");
  process.exit(1);
}

for (const path of ["/admin/", "/aluno/", "/familia/", "/professor/", "/auth/", "/api/", "/convite/"]) {
  if (!robots.includes(`"${path}"`)) {
    console.error(`Discoverability baseline: robots must protect ${path}`);
    process.exit(1);
  }
}

for (const publicUrl of ["politica-de-privacidade", "privacidade-da-crianca"]) {
  if (!sitemap.includes(publicUrl)) {
    console.error(`Discoverability baseline: sitemap missing ${publicUrl}`);
    process.exit(1);
  }
}
if (sitemap.includes("termos-de-uso")) {
  console.error("Discoverability baseline: unpublished terms must not be hard-coded in sitemap.");
  process.exit(1);
}

for (const eventName of ["landing_view", "lead_cta_click", "lead_form_submit", "lead_success", "login_click"]) {
  if (!publicAnalytics.includes(eventName) || !publicEvents.includes(eventName)) {
    console.error(`Discoverability baseline: analytics event missing ${eventName}`);
    process.exit(1);
  }
}

for (const pii of ["guardian_name", "phone_whatsapp", "email", "child_name", "child_age"]) {
  if (publicEvents.includes(pii)) {
    console.error(`Discoverability baseline: analytics endpoint must not accept PII field ${pii}`);
    process.exit(1);
  }
}

if (!publicEvents.includes('privacy: "no_pii"') || !publicEvents.includes('"cache-control": "no-store')) {
  console.error("Discoverability baseline: analytics privacy/no-store contract missing.");
  process.exit(1);
}

console.log("Discoverability baseline OK: static social card, crawler rules and no-PII public analytics verified.");
