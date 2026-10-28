// Loads every "exports" entry of the built package through Node itself, once with
// import() and once with require(), using the package's self-reference. Run after
// `npm run build`. Fails when an entry point cannot load, resolves to the wrong
// build, or exposes different names in ESM and CJS. Also fails when a src/ module
// has an index.ts but no matching "exports" entry.
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const require = createRequire(import.meta.url);
const problems = [];

const subpaths = Object.keys(pkg.exports);
const exported = new Set(subpaths.map(subpath => subpath.replace(/^\.\/?/, "")));

for (const entry of fs.readdirSync(path.join(root, "src"), { withFileTypes: true })) {
  if (entry.isDirectory() && fs.existsSync(path.join(root, "src", entry.name, "index.ts")) && !exported.has(entry.name)) {
    problems.push(`src/${entry.name} has an index.ts but no "./${entry.name}" entry in package.json "exports"`);
  }
}

for (const subpath of subpaths) {
  const specifier = path.posix.join(pkg.name, subpath);

  try {
    const esmFile = fileURLToPath(import.meta.resolve(specifier));
    const cjsFile = require.resolve(specifier);
    const esm = await import(specifier);
    const cjs = require(specifier);
    const esmNames = Object.keys(esm).filter(name => name !== "default").sort();
    const cjsNames = Object.keys(cjs).filter(name => name !== "__esModule").sort();

    if (!esmFile.includes(`${path.sep}dist${path.sep}esm${path.sep}`)) {
      problems.push(`${specifier}: import resolved outside dist/esm (${esmFile})`);
    }
    if (!cjsFile.includes(`${path.sep}dist${path.sep}cjs${path.sep}`)) {
      problems.push(`${specifier}: require resolved outside dist/cjs (${cjsFile})`);
    }
    if (esmNames.join() !== cjsNames.join()) {
      const onlyEsm = esmNames.filter(name => !cjsNames.includes(name));
      const onlyCjs = cjsNames.filter(name => !esmNames.includes(name));
      problems.push(`${specifier}: ESM and CJS exports differ (ESM only: ${onlyEsm.join(", ") || "none"}; CJS only: ${onlyCjs.join(", ") || "none"})`);
    }
  } catch (error) {
    problems.push(`${specifier}: failed to load (${error.message.split("\n")[0]})`);
  }
}

if (problems.length > 0) {
  console.error(`Package smoke test found ${problems.length} problem(s):\n`);
  console.error(problems.map(problem => `  ${problem}`).join("\n"));
  process.exit(1);
}

console.log(`Loaded all ${subpaths.length} entry points with both import and require.`);
