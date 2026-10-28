---
name: create-value-object
description: Add a value object with @schorts/shared-kernel — pick the right base class, set attributeName, validate with isValid, collect failures into ValuesNotValid, and round-trip through primitives. Use when modeling an ID, a constrained string or number, an enum, money, or any small immutable domain value.
---

# Create a value object

Value objects wrap a primitive with its rules. They never throw: construct, then check `isValid`.

## 1. Pick the base class

| The value is… | Extend | Constructor |
| --- | --- | --- |
| A UUID (v1–v8) | `UUIDValue` | `(value, optional = false)` |
| Text with length limits | `StringValue` | `(value, minLength = 0, maxLength?, optional = false)` |
| One of a fixed set | `EnumValue<typeof VALUES>` | `(allowedValues, value)` |
| An email, phone, slug, URL, or path | `EmailValue`, `PhoneValue`, `SlugValue`, `URLValue`, `PathValue` | `(value, …)` |
| A bounded integer or decimal | `IntegerValue`, `FloatValue` | `(value, min?, max?)` / `(value, decimals?, min?, max?)` |
| A date with bounds | `DateValue` | `(value, beforeDate?, afterDate?, optional = false)` |
| A plain object or array checked by a schema | `ObjectValue<T>`, `ArrayValue<T>` | `(value, schema)` |
| Anything else | `BaseValueObject<T>` | `(value)`; you implement `isValid` |

All of these are abstract: your subclass must declare `readonly attributeName`, the field name used in error reports.

## 2. Write the class

Fix the constructor arguments in your subclass so callers only pass the value:

```ts
// file: domain/order-note.ts
import { StringValue } from "@schorts/shared-kernel/value-objects";

export class OrderNote extends StringValue {
  readonly attributeName = "note";

  constructor(value: string) {
    super(value, 1, 500);
  }
}
```

```ts
// file: domain/order-status.ts
import { EnumValue } from "@schorts/shared-kernel/value-objects";

export const ORDER_STATUSES = ["draft", "placed", "cancelled"] as const;
export type OrderStatusName = (typeof ORDER_STATUSES)[number];

export class OrderStatus extends EnumValue<typeof ORDER_STATUSES> {
  readonly attributeName = "status";

  constructor(value: OrderStatusName) {
    super(ORDER_STATUSES, value);
  }
}
```

For a value with several fields, extend `BaseValueObject` and implement `valueType` and `isValid`. Equality compares `valueType` and the whole value deeply, and is always `false` when either side is invalid:

```ts
// file: domain/money.ts
import { BaseValueObject } from "@schorts/shared-kernel/value-objects";

export type MoneyPrimitives = { amount: number; currency: string };

export class Money extends BaseValueObject<MoneyPrimitives> {
  readonly valueType = "Money";
  readonly attributeName = "price";

  get isValid(): boolean {
    return (
      Number.isFinite(this.value.amount) &&
      this.value.amount >= 0 &&
      /^[A-Z]{3}$/.test(this.value.currency)
    );
  }

  add(other: Money): Money {
    if (other.value.currency !== this.value.currency) {
      throw new Error("Cannot add amounts in different currencies");
    }
    return new Money({ amount: this.value.amount + other.value.amount, currency: this.value.currency });
  }
}
```

Operations return new instances; never assign to `value`.

## 3. Validate at the boundary

Build all value objects for an input, then throw one `ValuesNotValid` listing every invalid field:

```ts
// file: domain/parse-order-input.ts
import { ValuesNotValid } from "@schorts/shared-kernel/value-objects";
import type { ValueObject } from "@schorts/shared-kernel/value-objects";
import { Money } from "./money.js";
import { OrderNote } from "./order-note.js";

function assertAllValid(values: ValueObject[]): void {
  const invalid = values.filter(value => !value.isValid);
  if (invalid.length > 0) {
    throw new ValuesNotValid(
      invalid.map(value =>
        Object.assign(new Error(`${value.attributeName} is not valid`), { attributeName: value.attributeName }),
      ),
    );
  }
}

export function parseOrderInput(input: { note: string; price: { amount: number; currency: string } }) {
  const note = new OrderNote(input.note);
  const price = new Money(input.price);
  assertAllValid([note, price]);
  return { note, price };
}
```

## 4. Store and restore

`toPrimitives()` returns the raw value; the static `fromPrimitives` on your subclass rebuilds it:

```ts
// file: domain/round-trip.ts
import { Money } from "./money.js";
import { OrderStatus } from "./order-status.js";

const price = Money.fromPrimitives({ amount: 25, currency: "USD" });
const stored = price.toPrimitives();
const restored = Money.fromPrimitives(stored);

export const sameValue = restored.equals(price);
export const status = OrderStatus.fromPrimitives("placed");
```

## 5. Test it

Cover valid input, each invalid case, equality, and the round trip:

```ts
// file: domain/money.test.ts
import { Money } from "./money.js";

describe("Money", () => {
  it("accepts non-negative amounts in ISO currencies", () => {
    expect(new Money({ amount: 10, currency: "USD" }).isValid).toBe(true);
  });

  it.each([
    { amount: -1, currency: "USD" },
    { amount: Number.NaN, currency: "USD" },
    { amount: 1, currency: "usd" },
  ])("rejects %j", input => {
    expect(new Money(input).isValid).toBe(false);
  });

  it("compares by value and round-trips through primitives", () => {
    const price = new Money({ amount: 10, currency: "USD" });
    expect(price.equals(new Money({ amount: 10, currency: "USD" }))).toBe(true);
    expect(Money.fromPrimitives(price.toPrimitives()).equals(price)).toBe(true);
  });
});
```

## Checklist

- [ ] Subclass of a kernel value object, with `attributeName`.
- [ ] Constructor fixes the limits, so callers pass only the value.
- [ ] No exceptions in the constructor; callers check `isValid`.
- [ ] Operations return new instances.
- [ ] Tests cover valid, invalid, `equals`, and `fromPrimitives(toPrimitives())`.
