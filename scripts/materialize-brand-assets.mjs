import { mkdir, readFile, writeFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const sourceDir = join(root, ".brand-assets");

const assets = [
  { prefix: "plumareli-symbol", outputs: [["brand", "plumareli-symbol.webp"]] },
  { prefix: "plumareli-wordmark", outputs: [["brand", "plumareli-wordmark.webp"]] },
  { prefix: "plumareli-primary-official", outputs: [["brand", "plumareli-primary.webp"]] },
  { prefix: "plumareli-symbol-official", outputs: [["brand", "plumareli-symbol-official.webp"]] },
  { prefix: "plumareli-wordmark-official", outputs: [["brand", "plumareli-wordmark-official.webp"]] },
  { prefix: "plumareli-negative", outputs: [["brand", "plumareli-negative.webp"]] },
  { prefix: "plumareli-irara", outputs: [["mascotes", "plumareli_irara_principal.webp"]] },
  {
    prefix: "plumareli-mico-leao-dourado",
    outputs: [
      ["mascotes", "plumareli_mico_leao_dourado_principal.webp"],
      ["mascotes", "curio_mico_principal_praticando.png"],
    ],
  },
  {
    prefix: "plumareli-harpia",
    outputs: [
      ["mascotes", "plumareli_harpia_principal.webp"],
      ["mascotes", "curio_harpia_principal_conquista_voando.png"],
    ],
  },
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
    throw new Error(`Ativo Plumareli inválido: ${asset.prefix}`);
  }

  for (const [directory, output] of asset.outputs) {
    const outputDir = join(root, "public", directory);
    await mkdir(outputDir, { recursive: true });
    await writeFile(join(outputDir, output), bytes);
    console.log(`Ativo Plumareli materializado: ${output} (${bytes.length} bytes)`);
  }
}
