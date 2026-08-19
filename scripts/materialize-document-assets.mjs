import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const sourceDir = join(root, ".document-assets");
const prefix = "manual-do-instrutor-plumareli-v2";
const outputDir = join(root, "public", "documentos");
const outputPath = join(outputDir, "manual-do-instrutor-plumareli-v2.pdf");

try {
  const files = await readdir(sourceDir);
  const parts = files
    .filter((file) => file.startsWith(`${prefix}.`) && file.endsWith(".b64"))
    .sort((a, b) => a.localeCompare(b));

  if (!parts.length) {
    console.warn("Documentos Plumareli: partes do Manual do Instrutor não encontradas.");
    process.exit(0);
  }

  const chunks = await Promise.all(parts.map((file) => readFile(join(sourceDir, file), "utf8")));
  const bytes = Buffer.from(chunks.join("").replace(/\s+/g, ""), "base64");

  if (bytes.length < 1000 || bytes.subarray(0, 5).toString("ascii") !== "%PDF-") {
    throw new Error("Manual do Instrutor inválido após materialização.");
  }

  await mkdir(outputDir, { recursive: true });
  await writeFile(outputPath, bytes);
  console.log(`Documento Plumareli materializado: manual-do-instrutor-plumareli-v2.pdf (${bytes.length} bytes)`);
} catch (error) {
  console.error("Documentos Plumareli: não foi possível materializar o Manual do Instrutor.", error?.message || error);
  process.exitCode = 1;
}
