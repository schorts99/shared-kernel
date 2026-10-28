import {
  AbstractCommand,
  CoordinatesValue,
  DateValue,
  EmailValue,
  SlugValue,
  URLValue,
  AbstractQuery,
  BaseValueObject,
  CommandRegistry,
  DomainEvent,
  DomainEventRegistry,
  Entity,
  QueryRegistry,
  UUIDValue,
} from "../../src";
import type {
  DomainEventMetadata,
} from "../../src";

export class TestCommand extends AbstractCommand<{ id: string; value?: string }> {
  static readonly TYPE = "test.command";

  getType(): string {
    return TestCommand.TYPE;
  }

  override getPayload() {
    return this.payload;
  }
}

export class SecondaryCommand extends AbstractCommand<{ id: string }> {
  static readonly TYPE = "secondary.command";

  getType(): string {
    return SecondaryCommand.TYPE;
  }

  override getPayload() {
    return this.payload;
  }
}

export class TestQuery extends AbstractQuery<{ id: string }> {
  static readonly TYPE = "test.query";

  getType(): string {
    return TestQuery.TYPE;
  }

  override getPayload() {
    return this.payload;
  }
}

export class TestDomainEvent extends DomainEvent<{ id: string }> {
  static readonly NAME = "test.event";

  constructor(
    correlationId: string,
    payload: { id: string },
    customMetadata?: Partial<DomainEventMetadata>,
  ) {
    super(correlationId, payload, customMetadata);
  }

  getEventName(): string {
    return TestDomainEvent.NAME;
  }

  override getPayload() {
    return this.payload;
  }
}

export class MoneyValue extends BaseValueObject<{ amount: number; currency: string }> {
  readonly valueType = "Money";
  readonly attributeName = "price";

  get isValid(): boolean {
    return Number.isFinite(this.value.amount) && this.value.currency.length === 3;
  }

  override equals(other: unknown): boolean {
    return (
      other instanceof MoneyValue &&
      this.isValid &&
      other.isValid &&
      this.value.amount === other.value.amount &&
      this.value.currency === other.value.currency
    );
  }
}

export class OrderEntity extends Entity<UUIDValue, { id: string; total: number; items: string[] }> {
  constructor(
    id: UUIDValue,
    public total: number,
    public items: string[],
  ) {
    super(id);
  }

  toPrimitives() {
    return {
      id: this.id.value,
      total: this.total,
      items: [...this.items],
    };
  }
}

export function registerTestMessages(): void {
  CommandRegistry.register(TestCommand.TYPE, TestCommand);
  CommandRegistry.register(SecondaryCommand.TYPE, SecondaryCommand);
  QueryRegistry.register(TestQuery.TYPE, TestQuery);
  DomainEventRegistry.register(TestDomainEvent.NAME, TestDomainEvent);
}

// Concrete value objects for tests; the library's value objects are abstract and
// need an attributeName.
export class TestUUIDValue extends UUIDValue {
  readonly attributeName = "id";
}

export class TestEmailValue extends EmailValue {
  readonly attributeName = "email";
}

export class TestSlugValue extends SlugValue {
  readonly attributeName = "slug";
}

export class TestCoordinatesValue extends CoordinatesValue {
  readonly attributeName = "coordinates";
}

export class TestDateValue extends DateValue {
  readonly attributeName = "date";
}

export class TestURLValue extends URLValue {
  readonly attributeName = "url";
}
