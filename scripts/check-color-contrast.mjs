import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(process.cwd(), "app/themes.css"), "utf8");

function blockFor(selector) {
  const selectorIndex = source.indexOf(selector);
  if (selectorIndex < 0) throw new Error(`Tema não encontrado: ${selector}`);
  const open = source.indexOf("{", selectorIndex);
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return source.slice(open + 1, index);
  }
  throw new Error(`Bloco CSS incompleto: ${selector}`);
}

function tokens(block) {
  return new Map(
    [...block.matchAll(/(--plum-[\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)].map((match) => [match[1], match[2]]),
  );
}

function channel(value) {
  const normalized = value / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

function luminance(hex) {
  const value = hex.slice(1);
  const r = channel(Number.parseInt(value.slice(0, 2), 16));
  const g = channel(Number.parseInt(value.slice(2, 4), 16));
  const b = channel(Number.parseInt(value.slice(4, 6), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(foreground, background) {
  const a = luminance(foreground);
  const b = luminance(background);
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}

const light = tokens(blockFor('html[data-theme="light"]'));
const dark = tokens(blockFor('html[data-theme="dark"]'));

const checks = [
  ["claro: texto/canvas", light, "--plum-text", "--plum-canvas", 4.5],
  ["claro: texto secundário/canvas", light, "--plum-text-muted", "--plum-canvas", 4.5],
  ["claro: texto/superfície", light, "--plum-text", "--plum-surface-raised", 4.5],
  ["claro: azul de texto/canvas", light, "--plum-blue-ink", "--plum-canvas", 4.5],
  ["claro: rosa de texto/canvas", light, "--plum-pink-ink", "--plum-canvas", 4.5],
  ["claro: verde de texto/canvas", light, "--plum-green-ink", "--plum-canvas", 4.5],
  ["claro: amarelo de texto/canvas", light, "--plum-yellow-ink", "--plum-canvas", 4.5],
  ["claro: botão primário início", light, "--plum-action-text", "--plum-action-start", 4.5],
  ["claro: botão primário fim", light, "--plum-action-text", "--plum-action-end", 4.5],
  ["claro: botão rosa início", light, "--plum-on-bright", "--plum-pink-fill-start", 4.5],
  ["claro: botão rosa fim", light, "--plum-on-bright", "--plum-pink-fill-end", 4.5],
  ["escuro: texto/canvas", dark, "--plum-text", "--plum-canvas", 4.5],
  ["escuro: texto secundário/canvas", dark, "--plum-text-muted", "--plum-canvas", 4.5],
  ["escuro: texto/superfície", dark, "--plum-text", "--plum-surface-raised", 4.5],
  ["escuro: azul de texto/canvas", dark, "--plum-blue-ink", "--plum-canvas", 4.5],
  ["escuro: rosa de texto/canvas", dark, "--plum-pink-ink", "--plum-canvas", 4.5],
  ["escuro: botão primário início", dark, "--plum-action-text", "--plum-action-start", 4.5],
  ["escuro: botão primário fim", dark, "--plum-action-text", "--plum-action-end", 4.5],
  ["escuro: botão rosa início", dark, "--plum-on-bright", "--plum-pink-fill-start", 4.5],
  ["escuro: botão rosa fim", dark, "--plum-on-bright", "--plum-pink-fill-end", 4.5],
];

let failed = false;
for (const [label, palette, foregroundToken, backgroundToken, minimum] of checks) {
  const foreground = palette.get(foregroundToken);
  const background = palette.get(backgroundToken);
  if (!foreground || !background) {
    console.error(`Contraste: token ausente em ${label}: ${foregroundToken} / ${backgroundToken}`);
    failed = true;
    continue;
  }
  const value = ratio(foreground, background);
  if (value < minimum) {
    console.error(`Contraste insuficiente em ${label}: ${value.toFixed(2)}:1 (mínimo ${minimum}:1)`);
    failed = true;
  }
}

if (failed) process.exit(1);
console.log(`Contraste OK: ${checks.length} pares semânticos principais validados.`);
