// Fails when a relative import in src/ does not point at an explicit .js file.
// The ESM build resolves imports like a bundler, so "./foo" or "./dir" still compile
// but break when Node loads dist/esm. Every relative specifier must be "./foo.js"
// or "./dir/index.js" and match a .ts source file.
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..", "src");
const SPECIFIER = /(?:\bfrom\s*|\bimport\s*\(?\s*)(["'])(\.{1,2}(?:\/[^"']*)?)\1/g;

function listFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return listFiles(full);
    return entry.name.endsWith(".ts") ? [full] : [];
  });
}

const problems = [];

for (const file of listFiles(root)) {
  const lines = fs.readFileSync(file, "utf8").split("\n");

  lines.forEach((line, index) => {
    for (const match of line.matchAll(SPECIFIER)) {
      const specifier = match[2];
      const location = `${path.relative(process.cwd(), file)}:${index + 1}`;

      if (!specifier.endsWith(".js")) {
        problems.push(`${location}  "${specifier}" must end in .js (use "./file.js" or "./dir/index.js")`);
        continue;
      }

      const source = path.resolve(path.dirname(file), specifier.replace(/\.js$/, ".ts"));
      if (!fs.existsSync(source)) {
        problems.push(`${location}  "${specifier}" does not match a source file`);
      }
    }
  });
}

if (problems.length > 0) {
  console.error(`Found ${problems.length} relative import(s) that will break the ESM build:\n`);
  console.error(problems.map(problem => `  ${problem}`).join("\n"));
  process.exit(1);
}

console.log("All relative imports in src/ use explicit .js paths.");
