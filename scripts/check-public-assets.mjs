import { access, readdir, readFile, stat } from "node:fs/promises";
import { constants } from "node:fs";
import { extname, join, relative } from "node:path";
import nextConfig from "../next.config.mjs";

const root = process.cwd();
const publicDir = join(root, "public");
const scanRoots = ["app", "components"];
const sourceExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".css"]);
const assetPattern = /\/(?:brand|mascotes)\/[A-Za-z0-9._/-]+\.(?:png|jpe?g|webp|svg|avif|ico)(?:\?[^\s"'`)]+)?/gi;
const largeAssetThreshold = 900 * 1024;

async function exists(path) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(fullPath)));
    else if (sourceExtensions.has(extname(entry.name))) files.push(fullPath);
  }

  return files;
}

function isExampleOnlyReference(content, match) {
  const index = match.index ?? 0;
  const before = content.slice(Math.max(0, index - 120), index);
  return /placeholder\s*=\s*["'][^"']*$/i.test(before);
}

const rewriteConfig = typeof nextConfig.rewrites === "function" ? await nextConfig.rewrites() : null;
const fallbackRules = Array.isArray(rewriteConfig) ? [] : rewriteConfig?.fallback ?? [];
const fallbackMap = new Map(
  fallbackRules
    .filter((rule) => typeof rule?.source === "string" && typeof rule?.destination === "string")
    .map((rule) => [rule.source.split("?")[0], rule.destination.split("?")[0]]),
);

async function resolveAsset(publicPath, visited = new Set()) {
  const normalized = publicPath.split("?")[0];
  if (visited.has(normalized)) return null;
  visited.add(normalized);

  const diskPath = join(publicDir, normalized.replace(/^\//, ""));
  if (await exists(diskPath)) return { publicPath: normalized, diskPath, viaFallback: visited.size > 1 };

  const fallback = fallbackMap.get(normalized);
  if (!fallback?.startsWith("/")) return null;
  return resolveAsset(fallback, visited);
}

const references = new Map();
for (const scanRoot of scanRoots) {
  const directory = join(root, scanRoot);
  if (!(await exists(directory))) continue;

  for (const file of await walk(directory)) {
    const content = await readFile(file, "utf8");
    for (const match of content.matchAll(assetPattern)) {
      if (isExampleOnlyReference(content, match)) continue;
      const asset = match[0].split("?")[0];
      if (!references.has(asset)) references.set(asset, new Set());
      references.get(asset).add(relative(root, file));
    }
  }
}

const missing = [];
const fallbackUsages = [];
const heavy = new Map();

for (const [asset, files] of references) {
  const resolved = await resolveAsset(asset);
  if (!resolved) {
    missing.push({ asset, files: [...files] });
    continue;
  }

  if (resolved.viaFallback) fallbackUsages.push({ asset, resolved: resolved.publicPath });

  const fileStat = await stat(resolved.diskPath);
  if (fileStat.size >= largeAssetThreshold) {
    heavy.set(resolved.publicPath, fileStat.size);
  }
}

console.log(`Assets Plumareli: ${references.size} caminho(s) local(is) verificado(s).`);

if (fallbackUsages.length) {
  console.log(`Assets Plumareli: ${fallbackUsages.length} caminho(s) dependem de fallback neste checkout.`);
  for (const item of fallbackUsages) console.log(`  fallback: ${item.asset} -> ${item.resolved}`);
}

if (heavy.size) {
  console.warn("Assets Plumareli: imagens grandes em uso (recomenda-se WebP/AVIF quando houver versão oficial):");
  for (const [asset, size] of [...heavy.entries()].sort((a, b) => b[1] - a[1])) {
    console.warn(`  ${(size / 1024).toFixed(0)} KB  ${asset}`);
  }
}

if (missing.length) {
  console.error("Assets Plumareli: referências sem arquivo e sem fallback válido:");
  for (const item of missing) {
    console.error(`  ${item.asset}`);
    for (const file of item.files) console.error(`    usado em: ${file}`);
  }
  process.exitCode = 1;
} else {
  console.log("Assets Plumareli: nenhuma referência local quebrada encontrada.");
}
