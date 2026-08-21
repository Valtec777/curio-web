import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), "utf8");

const pkg = JSON.parse(read("package.json"));
const rolesAuth = read("e2e/tests/roles-auth.spec.cjs");
const workflow = read(".github/workflows/go-live-readiness.yml");

const requiredStaticMarkers = [
  [pkg.scripts?.["go-live:check"], "script go-live:check"],
  [rolesAuth.includes('E2E_REQUIRE_AUTH === "1"'), "modo estrito de autenticação E2E"],
  [workflow.includes("workflow_dispatch:"), "workflow manual"],
  [workflow.includes("environment: production"), "environment de produção"],
  [workflow.includes("confirm_leaked_password_protection"), "confirmação de leaked password protection"],
  [workflow.includes("confirm_rollback_ready"), "confirmação de rollback"],
  [workflow.includes('E2E_REQUIRE_AUTH: "1"'), "autenticação obrigatória no go-live"],
  [workflow.includes("PLAYWRIGHT_TEST_BASE_URL"), "URL externa para Playwright"],
];

for (const [ok, label] of requiredStaticMarkers) {
  if (!ok) {
    console.error(`Go-live readiness: contrato ausente: ${label}.`);
    process.exit(1);
  }
}

const requiredSecretNames = [
  "E2E_ADMIN_EMAIL",
  "E2E_ADMIN_PASSWORD",
  "E2E_TEACHER_EMAIL",
  "E2E_TEACHER_PASSWORD",
  "E2E_GUARDIAN_EMAIL",
  "E2E_GUARDIAN_PASSWORD",
  "E2E_STUDENT_EMAIL",
  "E2E_STUDENT_PASSWORD",
];

for (const secret of requiredSecretNames) {
  if (!workflow.includes(`secrets.${secret}`)) {
    console.error(`Go-live readiness: workflow não referencia ${secret}.`);
    process.exit(1);
  }
}

if (process.env.GO_LIVE_STRICT === "1") {
  const targetUrl = process.env.PLAYWRIGHT_TEST_BASE_URL;
  if (!targetUrl) {
    console.error("Go-live readiness: PLAYWRIGHT_TEST_BASE_URL é obrigatório.");
    process.exit(1);
  }

  let parsed;
  try {
    parsed = new URL(targetUrl);
  } catch {
    console.error("Go-live readiness: URL candidata inválida.");
    process.exit(1);
  }

  const blockedHosts = new Set(["localhost", "127.0.0.1", "example.com", "example.supabase.co"]);
  if (parsed.protocol !== "https:" || blockedHosts.has(parsed.hostname)) {
    console.error("Go-live readiness: a URL candidata deve ser HTTPS e não pode ser localhost/exemplo.");
    process.exit(1);
  }

  if (process.env.GO_LIVE_LEAKED_PASSWORD_PROTECTION !== "true") {
    console.error("Go-live readiness: confirme Leaked Password Protection antes do corte.");
    process.exit(1);
  }

  if (process.env.GO_LIVE_ROLLBACK_READY !== "true") {
    console.error("Go-live readiness: confirme que o rollback está pronto antes do corte.");
    process.exit(1);
  }

  const missingSecrets = requiredSecretNames.filter((name) => !process.env[name]?.trim());
  if (missingSecrets.length) {
    console.error(`Go-live readiness: faltam ${missingSecrets.length} secret(s) E2E obrigatório(s).`);
    process.exit(1);
  }

  const emailNames = requiredSecretNames.filter((name) => name.endsWith("_EMAIL"));
  const invalidEmails = emailNames.filter((name) => !process.env[name].includes("@"));
  if (invalidEmails.length) {
    console.error("Go-live readiness: há credencial E2E com e-mail inválido.");
    process.exit(1);
  }

  console.log("Go-live readiness STRICT OK: URL HTTPS, acknowledgements e quatro perfis E2E presentes.");
} else {
  console.log("Go-live readiness contract OK: gate manual e autenticação estrita estão versionados.");
}
