# 💻 Rule: TypeScript & Package Export Standards

This rule specifies compiler settings, module design, subpath export structures, and code style within `@schorts/shared-kernel`.

---

## 1. Subpath Exports & Build Targets (`package.json`)

`@schorts/shared-kernel` relies on Node.js subpath exports to support modular tree-shaking and zero-overhead imports.

### Subpath Export Rules:
1. **Module Directories**: Every subfolder in `src/` (e.g., `src/criteria`, `src/value-objects`) MUST contain an `index.ts` file that re-exports all public classes, types, and interfaces within that subfolder.
2. **Root Export**: `src/index.ts` MUST re-export every subfolder module using `export * from "./<module>"`.
3. **Package.json Export Registration**:
   When adding a new subfolder in `src/` (e.g. `src/new-module`), add a corresponding subpath entry in `package.json`:
   ```json
   "./new-module": {
     "import": "./dist/esm/new-module/index.js",
     "require": "./dist/cjs/new-module/index.js",
     "types": "./dist/types/new-module/index.d.ts"
   }
   ```
4. **Dual Build Targets**:
   - ESM target: compiled via `tsconfig.esm.json` into `./dist/esm`.
   - CJS target: compiled via `tsconfig.cjs.json` into `./dist/cjs`.
   - Declaration maps: outputted to `./dist/types`.

---

## 2. Strict TypeScript Rules (`tsconfig.json`)

1. **Strict Type Checking**: `"strict": true` is enforced. Do NOT use `any` unless explicitly performing low-level reflection or dynamic proxying (and cast `any` internally).
2. **Indexed Access Safeguard**: `"noUncheckedIndexedAccess": true` is enabled. Array or index signature lookups return `T | undefined`. Always guard array element accesses.
3. **Optional Property Types**: `"exactOptionalPropertyTypes": true` is enabled. A property declared as `prop?: string` cannot be explicitly assigned `undefined` unless declared as `prop?: string | undefined`.
4. **Import Conventions**:
   - Use relative imports within `src/` (e.g. `import { Entity } from "../entities"`).
   - Use type-only imports (`import type { ... }`) when importing types or interfaces to prevent runtime import bloat in compiled output.

---

## 3. Naming Conventions

1. **Files & Folders**: `kebab-case` for file names and directory names (e.g., `aggregate-root.ts`, `domain-events/`).
2. **Classes & Interfaces**: `PascalCase` for class names, interfaces, and type aliases (e.g., `BaseValueObject`, `CommandBus`).
3. **Methods & Variables**: `camelCase` for methods, getters, and local variables.
4. **Private/Protected Members**: Prefix private backing fields with an underscore if exposed via getters (e.g., `private _version: number`).
