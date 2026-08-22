import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const forbiddenGlobalNames = /(urgent|final|complete|fixes|polish)/i;

function source(file) {
  return readFileSync(resolve(root, file), "utf8");
}

function cssImports(file) {
  return [...source(file).matchAll(/import\s+["']([^"']+\.css)["'];?/g)].map((match) => match[1]);
}

function cssAtImports(file) {
  return [...source(file).matchAll(/@import\s+["']([^"']+\.css)["'];?/g)].map((match) => match[1]);
}

function assertEqual(actual, expected, label) {
  if (actual.length !== expected.length || actual.some((item, index) => item !== expected[index])) {
    console.error(`CSS architecture: ${label} must be ${expected.join(" → ")}; found ${actual.join(" → ") || "none"}.`);
    process.exit(1);
  }
}

const rootImports = cssImports("app/layout.tsx");
const expectedRootImports = [
  "./globals.css",
  "./design-system.css",
  "./themes.css",
  "./app-shell.css",
  "./brand-slot.css",
  "./responsive.css",
  "./public-brand.css",
  "./accessibility.css",
  "./onboarding-launcher-compact.css",
];

const forbidden = rootImports.filter((item) => forbiddenGlobalNames.test(item));
if (forbidden.length) {
  console.error(`CSS architecture: temporary patch stylesheets cannot be imported globally: ${forbidden.join(", ")}`);
  process.exit(1);
}

assertEqual(rootImports, expectedRootImports, "root CSS order");

assertEqual(cssAtImports("app/public-brand.css"), ["./public.css"], "public-brand.css import chain");
assertEqual(cssAtImports("app/public.css"), ["./public-site.css"], "public.css import chain");
assertEqual(cssAtImports("app/public-site.css"), ["./referrals.css"], "public-site.css import chain");

const roleLayouts = [
  ["Aluno", "app/aluno/layout.tsx", "./student.css"],
  ["Professor", "app/professor/layout.tsx", "./teacher.css"],
  ["Família", "app/familia/layout.tsx", "./family.css"],
  ["Admin", "app/admin/layout.tsx", "./admin.css"],
];

for (const [label, file, expectedEntrypoint] of roleLayouts) {
  const imports = cssImports(file);
  assertEqual(imports, [expectedEntrypoint], `${label} CSS entrypoint`);
}

console.log("CSS architecture OK: semantic global order, public import chain and one canonical entrypoint per authenticated role.");
