import process from "node:process";

const rawTarget = process.argv[2] || process.env.MONITOR_TARGET_URL;
const allowHttp = process.env.ALLOW_HTTP_MONITOR === "1";

if (!rawTarget) {
  console.error("Synthetic monitor: informe a URL em MONITOR_TARGET_URL ou como primeiro argumento.");
  process.exit(1);
}

let target;
try {
  target = new URL(rawTarget);
} catch {
  console.error("Synthetic monitor: URL inválida.");
  process.exit(1);
}

if (target.protocol !== "https:" && !(allowHttp && target.protocol === "http:")) {
  console.error("Synthetic monitor: o alvo deve usar HTTPS.");
  process.exit(1);
}

const origin = target.origin;
const timeoutMs = 10_000;
const results = [];

async function check(path, validate) {
  const url = new URL(path, `${origin}/`);
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent": "Plumareli-Synthetic-Monitor/1.0",
        accept: "text/html,text/plain,application/xml;q=0.9,*/*;q=0.8",
      },
    });
    const body = await response.text();
    const ms = Date.now() - startedAt;

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    await validate({ response, body, ms, url });
    results.push({ path, status: "ok", ms });
    console.log(JSON.stringify({ level: "info", msg: "synthetic_monitor", path, status: "ok", ms }));
  } catch (error) {
    const ms = Date.now() - startedAt;
    const message = error instanceof Error ? error.message : String(error);
    results.push({ path, status: "failed", ms, error: message });
    console.error(JSON.stringify({ level: "error", msg: "synthetic_monitor", path, status: "failed", ms, error: message }));
  } finally {
    clearTimeout(timeout);
  }
}

await check("/", async ({ response, body, ms }) => {
  if (!body.includes("Organize o que estudar agora")) throw new Error("landing sem proposta de valor esperada");
  if (response.headers.get("x-frame-options") !== "DENY") throw new Error("X-Frame-Options diferente de DENY");
  if (response.headers.get("x-content-type-options") !== "nosniff") throw new Error("X-Content-Type-Options ausente");
  const csp = response.headers.get("content-security-policy") || "";
  if (!csp.includes("frame-ancestors 'none'")) throw new Error("CSP sem frame-ancestors 'none'");
  if (ms > 5_000) console.warn(JSON.stringify({ level: "warn", msg: "synthetic_latency", path: "/", ms, threshold_ms: 5000 }));
});

await check("/login", async ({ body, ms }) => {
  if (!body.includes("Entrar no PLUMARELI")) throw new Error("login sem título esperado");
  if (ms > 5_000) console.warn(JSON.stringify({ level: "warn", msg: "synthetic_latency", path: "/login", ms, threshold_ms: 5000 }));
});

await check("/robots.txt", async ({ body }) => {
  for (const marker of ["/admin/", "/professor/", "/aluno/", "/familia/", "/api/"]) {
    if (!body.includes(marker)) throw new Error(`robots sem ${marker}`);
  }
});

await check("/sitemap.xml", async ({ body }) => {
  for (const marker of ["politica-de-privacidade", "privacidade-da-crianca"]) {
    if (!body.includes(marker)) throw new Error(`sitemap sem ${marker}`);
  }
});

const failures = results.filter((result) => result.status === "failed");
const maxLatency = Math.max(...results.map((result) => result.ms));
console.log(JSON.stringify({
  level: failures.length ? "error" : "info",
  msg: "synthetic_monitor_summary",
  origin,
  checks: results.length,
  failures: failures.length,
  max_ms: maxLatency,
  privacy: "no_pii",
}));

if (failures.length) process.exit(1);
