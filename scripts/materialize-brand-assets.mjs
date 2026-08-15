import { mkdir, readFile, writeFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const sourceDir = join(root, ".brand-assets");
const outputDir = join(root, "public", "brand");

const assets = [
  { prefix: "plumareli-symbol", output: "plumareli-symbol.webp" },
  { prefix: "plumareli-wordmark", output: "plumareli-wordmark.webp" },
];

await mkdir(outputDir, { recursive: true });
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

  if (bytes.length < 100 || bytes.subarray(0, 4).toString("ascii") !== "RIFF" || bytes.subarray(8, 12).toString("ascii") !== "WEBP") {
    throw new Error(`Arquivo de marca inválido: ${asset.output}`);
  }

  await writeFile(join(outputDir, asset.output), bytes);
  console.log(`Marca materializada: ${asset.output} (${bytes.length} bytes)`);
}
