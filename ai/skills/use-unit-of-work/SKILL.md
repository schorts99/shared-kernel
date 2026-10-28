---
name: use-unit-of-work
description: Run several writes in one transaction with @schorts/shared-kernel — a UnitOfWorkRunner, passing the unit of work to every DAO call, the transactional outbox that stages domain events and publishes them only after commit, and the transactional command bus. Use when a change touches more than one record or must publish events reliably.
---

# Use a unit of work

A unit of work makes several writes succeed or fail together. With the transactional outbox it also guarantees that domain events are published only if the transaction commits. This skill transfers money between two accounts.

## 1. The entity and its events

```ts
// file: banking/account.ts
import { DomainEvent } from "@schorts/shared-kernel/domain-events";
import { Entity } from "@schorts/shared-kernel/entities";
import { UUIDValue } from "@schorts/shared-kernel/value-objects";

export class AccountId extends UUIDValue {
  readonly attributeName = "accountId";
}

export type AccountModel = { id: string; balance: number };
type Movement = { accountId: string; amount: number };

export class MoneyWithdrawn extends DomainEvent<Movement> {
  static readonly NAME = "banking.money_withdrawn";
  getEventName(): string {
    return MoneyWithdrawn.NAME;
  }
}

export class MoneyDeposited extends DomainEvent<Movement> {
  static readonly NAME = "banking.money_deposited";
  getEventName(): string {
    return MoneyDeposited.NAME;
  }
}

export class InsufficientFunds extends Error {
  override name = "InsufficientFunds";
}

export class Account extends Entity<AccountId, AccountModel> {
  constructor(id: AccountId, public balance = 0) {
    super(id);
  }

  withdraw(amount: number, correlationId: string): void {
    if (amount > this.balance) throw new InsufficientFunds(`Account ${this.id.value} cannot cover ${amount}`);
    this.balance -= amount;
    this.recordDomainEvent(new MoneyWithdrawn(correlationId, { accountId: this.id.value, amount }));
  }

  deposit(amount: number, correlationId: string): void {
    this.balance += amount;
    this.recordDomainEvent(new MoneyDeposited(correlationId, { accountId: this.id.value, amount }));
  }

  toPrimitives(): AccountModel {
    return { id: this.id.value, balance: this.balance };
  }
}
```

## 2. Run the work in a unit of work

- `runner.run(async uow => ...)` begins a transaction, commits when the callback returns, and rolls back when it throws.
- Pass `uow` to every DAO call. Reads with it see the transaction's own uncommitted writes.
- Register every changed entity or aggregate with `uow.collectEventsFrom(...)`. Its events are staged at commit and published after it; a rollback discards them.

```ts
// file: banking/transfer.ts
import type { DAO } from "@schorts/shared-kernel/dao";
import type { UnitOfWorkRunner } from "@schorts/shared-kernel/unit-of-work";
import type { Account, AccountModel } from "./account.js";

export class AccountNotFound extends Error {
  override name = "AccountNotFound";
}

export async function transfer(
  runner: UnitOfWorkRunner,
  accounts: DAO<AccountModel, Account>,
  input: { from: string; to: string; amount: number },
  correlationId: string,
): Promise<void> {
  await runner.run(async uow => {
    const from = await accounts.findByID(input.from, uow);
    const to = await accounts.findByID(input.to, uow);
    if (!from || !to) throw new AccountNotFound("Both accounts must exist");

    uow.collectEventsFrom?.([from, to]);
    from.withdraw(input.amount, correlationId);
    to.deposit(input.amount, correlationId);

    await accounts.update(from, uow);
    await accounts.update(to, uow);
  });
}
```

## 3. Wire the runner and the outbox

`InMemoryUnitOfWorkRunner` takes the outbox options: an `eventStore` where events are staged during commit, and the `eventBus` they are published to afterwards. For a real database, extend `AsyncUnitOfWorkRunner` and implement `createUnitOfWork()` (see [implement-dao](../implement-dao/SKILL.md) for a SQL unit of work), passing the same outbox options to `super(logger, { eventStore, eventBus })`.

```ts
// file: banking/bootstrap.ts
import { DomainEventRegistry } from "@schorts/shared-kernel/domain-events";
import { InMemoryEventBus, InMemoryEventStore } from "@schorts/shared-kernel/event-bus";
import { InMemoryUnitOfWorkRunner } from "@schorts/shared-kernel/unit-of-work";
import { MoneyDeposited, MoneyWithdrawn } from "./account.js";

export function createBanking() {
  DomainEventRegistry.register(MoneyWithdrawn.NAME, MoneyWithdrawn);
  DomainEventRegistry.register(MoneyDeposited.NAME, MoneyDeposited);

  const eventStore = new InMemoryEventStore();
  const eventBus = new InMemoryEventBus(eventStore);
  const runner = new InMemoryUnitOfWorkRunner({ eventStore, eventBus });
  return { eventBus, runner };
}
```

If publishing fails after commit, the events stay in the event store and `eventBus.replay()` delivers them later; the transaction is not undone.

## 4. Test it

`InMemoryDAO` joins `InMemoryUnitOfWork` transactions, so the rollback is real:

```ts
// file: banking/transfer.test.ts
import { InMemoryDAO } from "@schorts/shared-kernel/dao";
import { Account, AccountId, InsufficientFunds, MoneyDeposited, MoneyWithdrawn } from "./account.js";
import type { AccountModel } from "./account.js";
import { createBanking } from "./bootstrap.js";
import { transfer } from "./transfer.js";

const alice = "6f1c2b9e-1d2a-4f3b-8c4d-5e6f7a8b9c0d";
const bob = "7a2d3c0f-2e3b-4a4c-9d5e-6f7a8b9c0d1e";

async function setup() {
  const { eventBus, runner } = createBanking();
  const accounts = new InMemoryDAO<AccountModel, Account>();
  await accounts.create(new Account(new AccountId(alice), 100));
  await accounts.create(new Account(new AccountId(bob), 0));
  const published: string[] = [];
  for (const name of [MoneyWithdrawn.NAME, MoneyDeposited.NAME]) {
    eventBus.subscribe(name, {
      getName: () => `recorder-${name}`,
      subscribedTo: () => [name],
      handle: async event => {
        published.push(event.getEventName());
      },
    });
  }
  return { runner, accounts, published };
}

describe("transfer", () => {
  it("moves money and publishes both events after commit", async () => {
    const { runner, accounts, published } = await setup();

    await transfer(runner, accounts, { from: alice, to: bob, amount: 30 }, "corr-1");

    expect((await accounts.findByID(alice))?.balance).toBe(70);
    expect((await accounts.findByID(bob))?.balance).toBe(30);
    expect(published).toEqual([MoneyWithdrawn.NAME, MoneyDeposited.NAME]);
  });

  it("rolls back both writes and publishes nothing when a step fails", async () => {
    const { runner, accounts, published } = await setup();

    await expect(transfer(runner, accounts, { from: alice, to: bob, amount: 500 }, "corr-2")).rejects.toBeInstanceOf(InsufficientFunds);

    expect((await accounts.findByID(alice))?.balance).toBe(100);
    expect((await accounts.findByID(bob))?.balance).toBe(0);
    expect(published).toEqual([]);
  });
});
```

## With the command bus

To make every command transactional, give `InMemoryCommandBus` a `createUnitOfWork` factory and enable `transactional`. The handler receives `context.unitOfWork`: pass it to every DAO call and push events to `context.events`. The bus commits, then publishes the events.

```ts
// file: banking/transactional-bus.ts
import { InMemoryCommandBus } from "@schorts/shared-kernel/cqrs";
import type { EventBus } from "@schorts/shared-kernel/event-bus";
import { InMemoryUnitOfWork } from "@schorts/shared-kernel/unit-of-work";

export function createTransactionalCommandBus(eventBus: EventBus) {
  const commandBus = new InMemoryCommandBus({ eventBus, createUnitOfWork: () => new InMemoryUnitOfWork() });
  commandBus.setConfig({ transactional: true, autoPublishEvents: true });
  return commandBus;
}
```

If a commit fails ambiguously, the bus throws `CommitOutcomeUnknownError`. Do not retry it blindly: check durable storage, then resolve it (see the `cqrs` rules).

## Checklist

- [ ] All writes for one change run inside `runner.run` (or a transactional command).
- [ ] `uow` passed to every DAO call.
- [ ] Changed entities and aggregates registered with `uow.collectEventsFrom`.
- [ ] Runner configured with the outbox (`eventStore` and `eventBus`); events registered in `DomainEventRegistry`.
- [ ] Tests cover commit (state and events) and rollback (no state change, no events).
