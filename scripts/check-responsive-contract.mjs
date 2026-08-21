import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const responsive = readFileSync(resolve(process.cwd(), "app/responsive.css"), "utf8");

const contracts = [
  ["horizontal overflow containment", /overflow-x:\s*clip/],
  ["tablet breakpoint", /@media\s*\(max-width:\s*980px\)/],
  ["mobile breakpoint", /@media\s*\(max-width:\s*720px\)/],
  ["small phone breakpoint", /@media\s*\(max-width:\s*520px\)/],
  ["public navigation collapses on tablet", /\.public-nav\s*\{\s*display:\s*none\s*!important;\s*\}/],
  ["authenticated shell becomes single column", /\.app-frame,[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)\s*!important;/],
  ["mobile sidebar remains horizontally scrollable", /\.sidebar-nav,[\s\S]*?overflow-x:\s*auto\s*!important;/],
  ["mobile controls keep touch target", /\.button,[\s\S]*?min-height:\s*44px;/],
  ["small phones reduce header actions", /\.public-actions\s+\.button-primary\s*\{\s*display:\s*none\s*!important;\s*\}/],
];

const missing = contracts.filter(([, pattern]) => !pattern.test(responsive));
if (missing.length) {
  console.error(`Responsive contract failed: ${missing.map(([label]) => label).join(", ")}`);
  process.exit(1);
}

console.log(`Responsive contract OK: ${contracts.length} viewport safeguards verified.`);
