import {
  AbstractCommand,
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

  getPayload() {
    return this.payload;
  }
}

export class SecondaryCommand extends AbstractCommand<{ id: string }> {
  static readonly TYPE = "secondary.command";

  getType(): string {
    return SecondaryCommand.TYPE;
  }

  getPayload() {
    return this.payload;
  }
}

export class TestQuery extends AbstractQuery<{ id: string }> {
  static readonly TYPE = "test.query";

  getType(): string {
    return TestQuery.TYPE;
  }

  getPayload() {
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

  getPayload() {
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
