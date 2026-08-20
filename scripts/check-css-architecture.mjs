import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const forbiddenGlobalNames = /(urgent|final|complete|fixes|polish)/i;

function cssImports(file) {
  const source = readFileSync(resolve(root, file), "utf8");
  return [...source.matchAll(/import\s+["']([^"']+\.css)["'];?/g)].map((match) => match[1]);
}

const rootImports = cssImports("app/layout.tsx");
const forbidden = rootImports.filter((item) => forbiddenGlobalNames.test(item));

if (forbidden.length) {
  console.error(`CSS architecture: temporary patch stylesheets cannot be imported globally: ${forbidden.join(", ")}`);
  process.exit(1);
}

if (rootImports.length > 9) {
  console.error(`CSS architecture: app/layout.tsx has ${rootImports.length} CSS imports; keep the global surface at 9 or fewer.`);
  process.exit(1);
}

const roleLayouts = [
  ["Aluno", "app/aluno/layout.tsx"],
  ["Professor", "app/professor/layout.tsx"],
  ["Família", "app/familia/layout.tsx"],
  ["Admin", "app/admin/layout.tsx"],
];

for (const [label, file] of roleLayouts) {
  const imports = cssImports(file);
  if (imports.length !== 1) {
    console.error(`CSS architecture: ${label} must expose exactly one CSS entrypoint from ${file}; found ${imports.length}.`);
    process.exit(1);
  }
}

console.log(`CSS architecture OK: ${rootImports.length} global imports and one entrypoint per authenticated role.`);
