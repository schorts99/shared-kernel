// Marks each build output with its module format so Node loads dist/esm as ES modules
// and dist/cjs as CommonJS, regardless of the root package.json "type".
const fs = require("fs");
const path = require("path");

const dist = path.join(__dirname, "..", "dist");

for (const [dir, type] of [["esm", "module"], ["cjs", "commonjs"]]) {
  fs.writeFileSync(path.join(dist, dir, "package.json"), `${JSON.stringify({ type }, null, 2)}\n`);
}
