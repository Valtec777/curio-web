import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const serverClient = readFileSync(resolve(process.cwd(), "lib/supabase/server.ts"), "utf8");

const requiredFragments = [
  "PUBLIC_CONTENT_CACHE_SECONDS = 300",
  "PUBLIC_CONTENT_TAG = \"public-landing-data\"",
  "\"plans\", \"legal_documents\", \"characters\"",
  "!hasAuthenticatedSession",
  "requestMethod(input, init) === \"GET\"",
  "cache: \"force-cache\"",
  "revalidate: PUBLIC_CONTENT_CACHE_SECONDS",
  "tags: [PUBLIC_CONTENT_TAG",
];

const missing = requiredFragments.filter((fragment) => !serverClient.includes(fragment));
if (missing.length) {
  console.error(`Public cache contract failed: ${missing.join(", ")}`);
  process.exit(1);
}

if (!serverClient.includes("name.startsWith(\"sb-\") && name.includes(\"-auth-token\")")) {
  console.error("Public cache contract failed: authenticated Supabase sessions must bypass the shared public cache.");
  process.exit(1);
}

console.log("Public cache contract OK: landing reads cache for 5 minutes and authenticated sessions bypass the shared cache.");
