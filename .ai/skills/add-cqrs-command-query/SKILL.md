---
name: add-cqrs-command-query
description: Workflow for defining Commands, Queries, and Handlers in shared-kernel.
---

# 🛠️ Skill: Add a CQRS Command or Query

This skill details the process for implementing a new Command or Query alongside its corresponding Handler and registering it with the appropriate bus.

---

## Step 1: Create Command or Query Class

1. Create a file under `src/cqrs/` (or your feature domain folder, e.g. `src/cqrs/create-user-command.ts`).
2. Extend `AbstractCommand` for state mutations, or `AbstractQuery` for read requests. (`Command` and `Query` are the interfaces they implement.)
3. Implement `getType()`. The constructor takes the correlation ID first, then the payload.

### Command Template:

```typescript
import { AbstractCommand } from "./command.js";

export interface CreateUserPayload {
  readonly email: string;
  readonly name: string;
}

export class CreateUserCommand extends AbstractCommand<CreateUserPayload> {
  static readonly TYPE = "user.create";

  getType(): string {
    return CreateUserCommand.TYPE;
  }
}
```

### Query Template:

```typescript
import { AbstractQuery } from "./query.js";

export interface GetUserByIdPayload {
  readonly userId: string;
}

export class GetUserByIdQuery extends AbstractQuery<GetUserByIdPayload> {
  static readonly TYPE = "user.get_by_id";

  getType(): string {
    return GetUserByIdQuery.TYPE;
  }
}
```

---

## Step 2: Create Handler Class

Extend `AbstractCommandHandler` or `AbstractQueryHandler` and implement the protected `execute` method. Do not override `handle`: the bus calls `handle`, which runs validation, authorization, idempotency, timeouts, and logging around `execute`. Override `validate` or `authorize` to add checks.

### CommandHandler Template:

```typescript
import { AbstractCommandHandler } from "./command-handler.js";
import { CreateUserCommand } from "./create-user-command.js";
import { Result } from "../result/index.js";

export class CreateUserCommandHandler extends AbstractCommandHandler<CreateUserCommand, Result<string>> {
  override async validate(command: CreateUserCommand): Promise<void> {
    if (!command.getPayload().email.includes("@")) {
      throw new Error("A valid email is required");
    }
  }

  protected async execute(command: CreateUserCommand): Promise<Result<string>> {
    const { email, name } = command.getPayload();
    // Perform domain logic or call DAO / Repository
    return Result.success(`user:${email}:${name}`);
  }
}
```

### QueryHandler Template:

```typescript
import { AbstractQueryHandler } from "./query-handler.js";
import { GetUserByIdQuery } from "./get-user-by-id-query.js";

export class GetUserByIdQueryHandler extends AbstractQueryHandler<GetUserByIdQuery, { id: string } | null> {
  protected async execute(query: GetUserByIdQuery): Promise<{ id: string } | null> {
    return { id: query.getPayload().userId };
  }
}
```

A bus also accepts any object that implements the `CommandHandler` / `QueryHandler` interface, which only requires `handle`. Prefer the abstract classes unless you need full control.

---

## Step 3: Register with Bus

Register the handler with `InMemoryCommandBus` or `InMemoryQueryBus`:

```typescript
import { CommandRegistry, InMemoryCommandBus } from "@schorts/shared-kernel/cqrs";

// Lets the bus rebuild the command from primitives (idempotency replay, offline sync).
CommandRegistry.register(CreateUserCommand.TYPE, CreateUserCommand);

const commandBus = new InMemoryCommandBus();
commandBus.register(CreateUserCommand.TYPE, new CreateUserCommandHandler());

const result = await commandBus.dispatch(
  new CreateUserCommand("correlation-id", { email: "test@example.com", name: "Alice" }),
);
```

---

## Step 4: Update Exports

Ensure exports are added in `src/cqrs/index.ts` and `src/index.ts`, using explicit `.js` paths (`export * from "./create-user-command.js";`).
