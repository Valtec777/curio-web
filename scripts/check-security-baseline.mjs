import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const nextConfig = readFileSync(resolve(root, "next.config.mjs"), "utf8");
const publicActions = readFileSync(resolve(root, "app/actions.ts"), "utf8");

const requiredHeaders = [
  "Content-Security-Policy",
  "Referrer-Policy",
  "X-Content-Type-Options",
  "X-Frame-Options",
  "X-Permitted-Cross-Domain-Policies",
  "Permissions-Policy",
];

const missingHeaders = requiredHeaders.filter((header) => !nextConfig.includes(`key: \"${header}\"`));
if (missingHeaders.length) {
  console.error(`Security baseline: missing headers: ${missingHeaders.join(", ")}`);
  process.exit(1);
}

const requiredCsp = ["base-uri 'self'", "frame-ancestors 'none'", "form-action 'self'", "object-src 'none'"];
const missingCsp = requiredCsp.filter((directive) => !nextConfig.includes(directive));
if (missingCsp.length) {
  console.error(`Security baseline: missing CSP directives: ${missingCsp.join(", ")}`);
  process.exit(1);
}

const schemaStart = publicActions.indexOf("const leadSchema = z.object({");
const schemaEnd = publicActions.indexOf("});", schemaStart);
const schemaSource = schemaStart >= 0 && schemaEnd > schemaStart
  ? publicActions.slice(schemaStart, schemaEnd)
  : "";

if (!schemaSource.includes("z.enum(PUBLIC_GRADES)")) {
  console.error("Security baseline: public lead must use the explicit grade allowlist.");
  process.exit(1);
}

for (const forbidden of ["child_name", "child_age", "subjects", "main_difficulties", "message"]) {
  if (schemaSource.includes(forbidden)) {
    console.error(`Security baseline: public lead schema must not collect ${forbidden}.`);
    process.exit(1);
  }
}

const requiredMinimization = [
  "child_name: null",
  "child_age: null",
  "subjects: []",
  "main_difficulties: null",
  "message: null",
  "consent_contact: true",
  "if (gradeError || !grade?.id)",
  "digits.length >= 8 && digits.length <= 15",
];

const missingMinimization = requiredMinimization.filter((fragment) => !publicActions.includes(fragment));
if (missingMinimization.length) {
  console.error(`Security baseline: public lead safeguards missing: ${missingMinimization.join(", ")}`);
  process.exit(1);
}

console.log(`Security baseline OK: ${requiredHeaders.length} headers and public lead minimization verified.`);
