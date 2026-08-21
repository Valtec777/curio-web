import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
const lock = JSON.parse(readFileSync(resolve(root, "package-lock.json"), "utf8"));

const groups = ["dependencies", "devDependencies"];
const forbiddenRange = /^(latest|next|canary|beta|alpha|rc|[~^*]|[><=]|workspace:|file:|git\+|https?:)/i;
const prerelease = /-(alpha|beta|rc|canary|next|experimental)(\.|-|$)/i;
const semver = /^\d+\.\d+\.\d+$/;

for (const group of groups) {
  const declared = pkg[group] || {};
  const lockedRoot = lock.packages?.[""]?.[group] || {};

  for (const [name, version] of Object.entries(declared)) {
    if (typeof version !== "string" || forbiddenRange.test(version) || !semver.test(version) || prerelease.test(version)) {
      console.error(`Dependency policy: ${name} must use an exact stable version, received ${version}`);
      process.exit(1);
    }
    if (lockedRoot[name] !== version) {
      console.error(`Dependency policy: package-lock root differs for ${name}: ${lockedRoot[name]} != ${version}`);
      process.exit(1);
    }
    const locked = lock.packages?.[`node_modules/${name}`]?.version;
    if (locked !== version) {
      console.error(`Dependency policy: resolved ${name} differs from package.json: ${locked} != ${version}`);
      process.exit(1);
    }
  }
}

if (pkg.engines?.node !== ">=22.0.0 <27") {
  console.error("Dependency policy: Node runtime must remain >=22.0.0 <27.");
  process.exit(1);
}

if (pkg.dependencies?.react !== pkg.dependencies?.["react-dom"]) {
  console.error("Dependency policy: react and react-dom must stay on the same version.");
  process.exit(1);
}

console.log("Dependency policy OK: direct packages are exact, stable, lockfile-aligned and Node 22+ is required.");
