import { mkdir, readFile, writeFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const sourceDir = join(root, ".brand-assets");

const assets = [
  { prefix: "plumareli-symbol", outputs: [["brand", "plumareli-symbol.webp"]] },
  { prefix: "plumareli-wordmark", outputs: [["brand", "plumareli-wordmark.webp"]] },
  {
    prefix: "plumareli-user-primary-20260816",
    outputs: [
      ["brand", "plumareli-primary.webp"],
      ["brand", "plumareli-primary-20260816.webp"],
    ],
  },
  { prefix: "plumareli-negative-direct", outputs: [["brand", "plumareli-negative.webp"]] },
  { prefix: "plumareli-irara", outputs: [["mascotes", "plumareli_irara_principal.webp"]] },
  {
    prefix: "plumareli-user-mico-20260816",
    outputs: [
      ["mascotes", "plumareli_mico_leao_dourado_principal.webp"],
      ["mascotes", "plumareli_mico_leao_dourado_20260816.webp"],
    ],
  },
  { prefix: "plumareli-harpia", outputs: [["mascotes", "plumareli_harpia_principal.webp"]] },
];

let files = [];
try {
  files = await readdir(sourceDir);
} catch (error) {
  console.warn("Assets Plumareli: .brand-assets não disponível; usando arquivos versionados/fallbacks.", error?.message || error);
}

let materialized = 0;
let skipped = 0;

for (const asset of assets) {
  try {
    const parts = files
      .filter((file) => file.startsWith(`${asset.prefix}.`) && file.endsWith(".b64"))
      .sort((a, b) => a.localeCompare(b));

    if (!parts.length) {
      skipped += 1;
      console.warn(`Assets Plumareli: partes ausentes para ${asset.prefix}; fallback será usado.`);
      continue;
    }

    const chunks = await Promise.all(parts.map((file) => readFile(join(sourceDir, file), "utf8")));
    const bytes = Buffer.from(chunks.join("").replace(/\s+/g, ""), "base64");

    if (
      bytes.length < 100 ||
      bytes.subarray(0, 4).toString("ascii") !== "RIFF" ||
      bytes.subarray(8, 12).toString("ascii") !== "WEBP"
    ) {
      skipped += 1;
      console.warn(`Assets Plumareli: ${asset.prefix} inválido; fallback será usado.`);
      continue;
    }

    for (const [directory, output] of asset.outputs) {
      if (!output.endsWith(".webp")) {
        console.warn(`Assets Plumareli: extensão incompatível ignorada em ${output}.`);
        continue;
      }
      const outputDir = join(root, "public", directory);
      await mkdir(outputDir, { recursive: true });
      await writeFile(join(outputDir, output), bytes);
      materialized += 1;
      console.log(`Ativo Plumareli materializado: ${output} (${bytes.length} bytes)`);
    }
  } catch (error) {
    skipped += 1;
    console.warn(`Assets Plumareli: não foi possível materializar ${asset.prefix}; fallback será usado.`, error?.message || error);
  }
}

console.log(`Assets Plumareli: ${materialized} arquivo(s) materializado(s), ${skipped} grupo(s) usando fallback.`);
