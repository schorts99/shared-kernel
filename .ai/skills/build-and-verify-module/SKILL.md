---
name: build-and-verify-module
description: Verification workflow for TypeScript compilation, CJS/ESM distribution, and package export maps.
---

# 🛠️ Skill: Build and Verify Module Exports

This skill details how to build the project and verify subpath export integrity before publishing or committing code changes.

---

## Step 1: Check Import Paths and Types

```bash
npm run lint:imports
npm run typecheck
```

`lint:imports` fails on any relative import in `src/` that is not an explicit `.js` path (`"./file.js"` or `"./dir/index.js"`). Those compile but break the ESM build when Node loads it.

---

## Step 2: Run TypeScript Builds

Run both ESM and CJS compilation targets:

```bash
npm run build
```

Verify that compilation outputs appear under:
- `dist/cjs/` (CommonJS build, with `package.json` declaring `"type": "commonjs"`)
- `dist/esm/` (ES module build and its declarations, with `package.json` declaring `"type": "module"`)
- `dist/types/` (declarations for the CommonJS build)

---

## Step 3: Verify `package.json` Export Entries

Ensure any newly created directory under `src/<module>` is registered under `"exports"` in `package.json`, with types per condition:

```json
"./<module>": {
  "import": {
    "types": "./dist/esm/<module>/index.d.ts",
    "default": "./dist/esm/<module>/index.js"
  },
  "require": {
    "types": "./dist/types/<module>/index.d.ts",
    "default": "./dist/cjs/<module>/index.js"
  }
}
```

---

## Step 4: Check Barrel Export Files

1. Ensure `src/<module>/index.ts` re-exports all public symbols within `src/<module>/`.
2. Ensure `src/index.ts` contains `export * from "./<module>/index.js";`.

---

## Step 5: Validate the Built Package

```bash
npm run test:package
npm run lint:package
```

- `test:package` loads every `"exports"` entry with both `import` and `require`, checks each resolves into the right build, compares the ESM and CJS export names, and fails if a `src/` module has no `"exports"` entry.
- `lint:package` runs `publint` and `attw` to check the package metadata and that types resolve for Node16 (ESM and CJS) and bundlers.

`npm run prepublishOnly` runs all of the above plus the tests with coverage thresholds.
