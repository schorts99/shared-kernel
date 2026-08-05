---
name: add-value-object
description: Workflow for implementing, testing, and exporting new domain Value Objects in shared-kernel.
---

# 🛠️ Skill: Add a New Value Object

This skill provides step-by-step instructions to create a new Value Object in `src/value-objects/`.

---

## Step 1: Create the Value Object File

1. Navigate to `src/value-objects/`.
2. Create a file named after the concept in `kebab-case` (e.g. `currency-value.ts`).
3. Extend `BaseValueObject<T>` or implement `ValueObject<T>`.

### Code Template:

```typescript
import { BaseValueObject } from "./base-value-object";

export class CurrencyValue extends BaseValueObject<string> {
  readonly valueType = "Currency";
  readonly attributeName: string;

  constructor(value: string, attributeName = "currency") {
    super(value.toUpperCase());
    this.attributeName = attributeName;
  }

  get isValid(): boolean {
    // Enforce 3-letter ISO currency code
    return typeof this.value === "string" && /^[A-Z]{3}$/.test(this.value);
  }

  equals(other: unknown): boolean {
    if (!(other instanceof CurrencyValue)) return false;
    return super.equals(other);
  }
}
```

---

## Step 2: Export in Module Index Files

1. Add explicit export in `src/value-objects/index.ts`:
   ```typescript
   export * from "./currency-value";
   ```
2. Verify `src/index.ts` exports `* from "./value-objects"`.

---

## Step 3: Add Unit Tests

Create a test file under `__tests__/value-objects/currency-value.spec.ts`:

```typescript
import { CurrencyValue } from "../../src/value-objects/currency-value";

describe("CurrencyValue", () => {
  it("should validate correct ISO currency codes", () => {
    const usd = new CurrencyValue("usd");
    expect(usd.isValid).toBe(true);
    expect(usd.value).toBe("USD");
  });

  it("should invalidate incorrect codes", () => {
    const invalid = new CurrencyValue("INVALID");
    expect(invalid.isValid).toBe(false);
  });

  it("should evaluate equality correctly", () => {
    const c1 = new CurrencyValue("USD");
    const c2 = new CurrencyValue("USD");
    const c3 = new CurrencyValue("EUR");
    expect(c1.equals(c2)).toBe(true);
    expect(c1.equals(c3)).toBe(false);
  });
});
```

---

## Step 4: Verify Compilation

Run `npm run build` to verify ESM and CJS outputs compile without type errors.
