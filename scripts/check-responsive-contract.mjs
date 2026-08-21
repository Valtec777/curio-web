import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const responsive = readFileSync(resolve(process.cwd(), "app/responsive.css"), "utf8");
const publicBrand = readFileSync(resolve(process.cwd(), "app/public-brand.css"), "utf8");

const contracts = [
  ["horizontal overflow containment", responsive, /overflow-x:\s*clip/],
  ["tablet breakpoint", responsive, /@media\s*\(max-width:\s*980px\)/],
  ["mobile breakpoint", responsive, /@media\s*\(max-width:\s*720px\)/],
  ["small phone breakpoint", responsive, /@media\s*\(max-width:\s*520px\)/],
  ["public navigation collapses on tablet", responsive, /\.public-nav\s*\{\s*display:\s*none\s*!important;\s*\}/],
  ["authenticated shell becomes single column", responsive, /\.app-frame,[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)\s*!important;/],
  ["mobile sidebar remains horizontally scrollable", responsive, /\.sidebar-nav,[\s\S]*?overflow-x:\s*auto\s*!important;/],
  ["mobile controls keep touch target", responsive, /\.button,[\s\S]*?min-height:\s*44px;/],
  ["small phones reduce header actions", responsive, /\.public-actions\s+\.button-primary\s*\{\s*display:\s*none\s*!important;\s*\}/],
  ["current public hero collapses to one column", publicBrand, /@media\s*\(max-width:\s*980px\)[\s\S]*?\.curio-public-hero\s+\.hero-grid\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)/],
];

const missing = contracts.filter(([, source, pattern]) => !pattern.test(source));
if (missing.length) {
  console.error(`Responsive contract failed: ${missing.map(([label]) => label).join(", ")}`);
  process.exit(1);
}

console.log(`Responsive contract OK: ${contracts.length} viewport safeguards verified.`);
