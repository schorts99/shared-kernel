// Type-checks every ```ts block in ai/**/*.md against the package source, so the
// examples AI agents copy into consuming projects keep compiling.
//
// - Each Markdown file gets its own folder; its blocks never see another file's blocks.
// - A block whose first line is `// file: some/path.ts` is written to that path, so later
//   blocks can import it (`import { OrderId } from "./order-id.js"`).
// - Other blocks are written as standalone modules.
// - Fence a block as ```ts no-check to leave it out (for fragments or wrong-on-purpose code).
// - `<!-- check-uses: ../other/SKILL.md -->` first copies the other doc's `// file:` blocks
//   (except tests) into this doc's folder, so a skill can build on another skill's code.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const docsDir = path.join(root, "ai");
const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "shared-kernel-ai-docs-"));

function listMarkdown(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return listMarkdown(full);
    return entry.name.endsWith(".md") ? [full] : [];
  });
}

const FENCE = /^```(ts|typescript)([^\n]*)\n([\s\S]*?)^```$/gm;
const sources = [];
let blockCount = 0;

function fileBlocks(doc) {
  const text = fs.readFileSync(doc, "utf8");
  return [...text.matchAll(FENCE)]
    .filter(match => !match[2].includes("no-check"))
    .map(match => ({ code: match[3], header: match[3].match(/^\/\/ file: (\S+\.ts)\n/) }))
    .filter(block => block.header && !block.header[1].endsWith(".test.ts"));
}

for (const doc of listMarkdown(docsDir)) {
  const relDoc = path.relative(docsDir, doc);
  const docDir = path.join(workDir, relDoc.replace(/\.md$/, "").replace(/[\\/]/g, "__"));
  const text = fs.readFileSync(doc, "utf8");
  let index = 0;

  for (const [, used] of text.matchAll(/<!-- check-uses: (\S+) -->/g)) {
    const usedDoc = path.resolve(path.dirname(doc), used);
    if (!fs.existsSync(usedDoc)) throw new Error(`${relDoc} uses missing doc ${used}`);
    for (const block of fileBlocks(usedDoc)) {
      const target = path.join(docDir, block.header[1]);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, `// ${path.relative(docsDir, usedDoc)}\n${block.code}`);
    }
  }

  for (const match of text.matchAll(FENCE)) {
    if (match[2].includes("no-check")) continue;
    const code = match[3];
    const line = text.slice(0, match.index).split("\n").length;
    const header = code.match(/^\/\/ file: (\S+\.ts)\n/);
    const name = header ? header[1] : `block-${++index}.ts`;
    const target = path.join(docDir, name);

    if (sources.some(s => s.target === target)) {
      throw new Error(`${relDoc}:${line} writes ${name}, which an earlier block already wrote`);
    }
    fs.mkdirSync(path.dirname(target), { recursive: true });
    // Point compiler errors back at the Markdown file and line.
    fs.writeFileSync(target, `// ${relDoc}:${line}\n${code}`);
    sources.push({ target, relDoc, line });
    blockCount++;
  }
}

const tsconfig = {
  compilerOptions: {
    target: "ES2022",
    module: "esnext",
    moduleResolution: "bundler",
    strict: true,
    noUncheckedIndexedAccess: true,
    exactOptionalPropertyTypes: true,
    noImplicitOverride: true,
    noEmit: true,
    skipLibCheck: true,
    types: ["node", "jest"],
    typeRoots: [path.join(root, "node_modules/@types")],
    baseUrl: root,
    paths: {
      "@schorts/shared-kernel": ["src/index.ts"],
      "@schorts/shared-kernel/*": ["src/*/index.ts"],
    },
  },
  include: [path.join(workDir, "**/*.ts")],
};
fs.writeFileSync(path.join(workDir, "tsconfig.json"), JSON.stringify(tsconfig, null, 2));

const real = p => (fs.existsSync(p) ? fs.realpathSync(p) : p);

function fail(output, what) {
  // Rewrite temp paths to the Markdown file and line each block came from.
  const mapped = output.replace(/(?:^|(?<=\s|\())([^\s()]+?\.ts)(?:\((\d+),\d+\)|:(\d+):\d+)/gm, (whole, file, tscLine, jestLine) => {
    const source = sources.find(s => real(path.resolve(file)) === real(s.target) || real(file) === real(s.target));
    if (!source) return whole;
    // Line 1 of each temp file is the comment naming its source.
    return `ai/${source.relDoc}:${source.line + Number(tscLine ?? jestLine) - 1}`;
  });
  console.error(mapped.trim());
  console.error(`\nai/ code blocks ${what} (temp files kept in ${workDir}).`);
  process.exit(1);
}

try {
  execFileSync(path.join(root, "node_modules/.bin/tsc"), ["-p", path.join(workDir, "tsconfig.json")], {
    stdio: "pipe",
    encoding: "utf8",
  });
} catch (error) {
  fail(`${error.stdout ?? ""}${error.stderr ?? ""}`, "failed to type-check");
}

// Run the example tests too, so the behavior they show is real.
const testFiles = sources.filter(s => s.target.endsWith(".test.ts"));
if (testFiles.length > 0) {
  fs.writeFileSync(path.join(workDir, "tsconfig.jest.json"), JSON.stringify({
    extends: "./tsconfig.json",
    compilerOptions: { module: "commonjs", moduleResolution: "node10", ignoreDeprecations: "6.0" },
  }));
  const jestConfig = {
    rootDir: root,
    roots: [workDir],
    testMatch: ["**/*.test.ts"],
    testEnvironment: "node",
    transform: {
      "^.+\\.ts$": ["ts-jest", { tsconfig: path.join(workDir, "tsconfig.jest.json"), isolatedModules: true, diagnostics: false }],
    },
    moduleNameMapper: {
      "^@schorts/shared-kernel$": "<rootDir>/src/index.ts",
      "^@schorts/shared-kernel/(.*)$": "<rootDir>/src/$1/index.ts",
      "^(\\.{1,2}/.*)\\.js$": "$1",
    },
  };
  const configPath = path.join(workDir, "jest.config.json");
  fs.writeFileSync(configPath, JSON.stringify(jestConfig));
  try {
    execFileSync(path.join(root, "node_modules/.bin/jest"), ["--config", configPath, "--ci", "--silent"], {
      stdio: "pipe",
      encoding: "utf8",
      cwd: root,
    });
  } catch (error) {
    fail(`${error.stdout ?? ""}${error.stderr ?? ""}`, "have failing tests");
  }
}

console.log(`Type-checked ${blockCount} code blocks in ai/ and ran the tests in ${testFiles.length} of them.`);
fs.rmSync(workDir, { recursive: true, force: true });
