---
name: build-and-verify-module
description: Verification workflow for TypeScript compilation, CJS/ESM distribution, and package export maps.
---

# 🛠️ Skill: Build and Verify Module Exports

This skill details how to build the project and verify subpath export integrity before publishing or committing code changes.

---

## Step 1: Run TypeScript Builds

Run both ESM and CJS compilation targets:

```bash
npm run build
```

Verify that compilation outputs appear under:
- `dist/cjs/` (CommonJS build)
- `dist/esm/` (ES Module build)
- `dist/types/` (TypeScript declarations)

---

## Step 2: Verify `package.json` Export Entries

Ensure any newly created directory under `src/<module>` is registered under `"exports"` in `package.json`.

Check that all three entries exist for `<module>`:
- `"import": "./dist/esm/<module>/index.js"`
- `"require": "./dist/cjs/<module>/index.js"`
- `"types": "./dist/types/<module>/index.d.ts"`

---

## Step 3: Check Barrel Export Files

1. Ensure `src/<module>/index.ts` re-exports all public symbols within `src/<module>/`.
2. Ensure `src/index.ts` contains `export * from "./<module>";`.

---

## Step 4: Validate Subpath Imports

Verify that an external consumer can import from the subpath:

```typescript
import { Criteria } from "@schorts/shared-kernel/criteria";
import { FetchHTTPProvider } from "@schorts/shared-kernel/http";
import { Result } from "@schorts/shared-kernel/result";
```
