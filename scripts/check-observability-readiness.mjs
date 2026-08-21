import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), "utf8");

const pkg = JSON.parse(read("package.json"));
const actions = read("app/actions.ts");
const publicEvents = read("app/api/public-events/route.ts");
const synthetic = read("scripts/synthetic-monitor.mjs");
const workflow = read(".github/workflows/synthetic-monitoring.yml");
const goLiveWorkflow = read(".github/workflows/go-live-readiness.yml");

for (const script of ["observability:check", "synthetic:monitor"]) {
  if (!pkg.scripts?.[script]) {
    console.error(`Observability: script obrigatório ausente: ${script}`);
    process.exit(1);
  }
}

for (const marker of [
  'msg: "public_lead"',
  'privacy: "no_pii"',
  '"rejected_validation"',
  '"grade_lookup_failed"',
  '"insert_failed"',
  '"duplicate_accepted"',
  '"created"',
]) {
  if (!actions.includes(marker)) {
    console.error(`Observability: log estruturado do lead incompleto: ${marker}`);
    process.exit(1);
  }
}

for (const marker of ['msg: "public_analytics"', 'privacy: "no_pii"', '"cache-control": "no-store"']) {
  if (!publicEvents.includes(marker)) {
    console.error(`Observability: contrato do analytics público ausente: ${marker}`);
    process.exit(1);
  }
}

for (const marker of [
  "Plumareli-Synthetic-Monitor/1.0",
  '"/login"',
  '"/robots.txt"',
  '"/sitemap.xml"',
  "frame-ancestors 'none'",
  'msg: "synthetic_monitor_summary"',
  'privacy: "no_pii"',
]) {
  if (!synthetic.includes(marker)) {
    console.error(`Observability: monitor sintético incompleto: ${marker}`);
    process.exit(1);
  }
}

for (const forbidden of ["guardian_name", "phone_whatsapp", "child_name", "main_difficulties"]) {
  if (synthetic.includes(forbidden)) {
    console.error(`Observability: monitor sintético não pode conter campo pessoal: ${forbidden}`);
    process.exit(1);
  }
}

for (const marker of [
  "schedule:",
  'cron: "*/30 * * * *"',
  "MONITOR_TARGET_URL",
  "workflow_dispatch:",
  "synthetic-monitor.mjs",
]) {
  if (!workflow.includes(marker)) {
    console.error(`Observability: workflow sintético incompleto: ${marker}`);
    process.exit(1);
  }
}

if (!goLiveWorkflow.includes("synthetic:monitor")) {
  console.error("Observability: gate de go-live não executa monitor sintético.");
  process.exit(1);
}

console.log("Observability baseline OK: logs no-PII, synthetic monitor and go-live health gate verified.");
