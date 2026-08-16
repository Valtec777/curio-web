import { mkdir, readFile, writeFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const sourceDir = join(root, ".brand-assets");

const assets = [
  { prefix: "plumareli-symbol", directory: "brand", output: "plumareli-symbol.webp" },
  { prefix: "plumareli-wordmark", directory: "brand", output: "plumareli-wordmark.webp" },
  { prefix: "plumareli-irara", directory: "mascotes", output: "plumareli_irara_principal.webp" },
  { prefix: "plumareli-mico-leao-dourado", directory: "mascotes", output: "plumareli_mico_leao_dourado_principal.webp" },
  { prefix: "plumareli-harpia", directory: "mascotes", output: "plumareli_harpia_principal.webp" },
];

const files = await readdir(sourceDir);

for (const asset of assets) {
  const parts = files
    .filter((file) => file.startsWith(`${asset.prefix}.`) && file.endsWith(".b64"))
    .sort((a, b) => a.localeCompare(b));

  if (!parts.length) {
    throw new Error(`Nenhuma parte encontrada para ${asset.prefix}`);
  }

  const chunks = await Promise.all(parts.map((file) => readFile(join(sourceDir, file), "utf8")));
  const bytes = Buffer.from(chunks.join("").replace(/\s+/g, ""), "base64");

  if (
    bytes.length < 100 ||
    bytes.subarray(0, 4).toString("ascii") !== "RIFF" ||
    bytes.subarray(8, 12).toString("ascii") !== "WEBP"
  ) {
    throw new Error(`Arquivo de marca inválido: ${asset.output}`);
  }

  const outputDir = join(root, "public", asset.directory);
  await mkdir(outputDir, { recursive: true });
  await writeFile(join(outputDir, asset.output), bytes);
  console.log(`Ativo Plumareli materializado: ${asset.output} (${bytes.length} bytes)`);
}
