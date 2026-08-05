---
name: add-cqrs-command-query
description: Workflow for defining Commands, Queries, and Handlers in shared-kernel.
---

# 🛠️ Skill: Add a CQRS Command or Query

This skill details the process for implementing a new Command or Query alongside its corresponding Handler and registering it with the appropriate bus.

---

## Step 1: Create Command or Query Class

1. Create a file under `src/cqrs/` (or your feature domain folder, e.g. `src/cqrs/create-user-command.ts`).
2. Extend `Command` for state mutations, or `Query` for read requests.

### Command Template:

```typescript
import { Command } from "./command";

export interface CreateUserPayload {
  readonly email: string;
  readonly name: string;
}

export class CreateUserCommand extends Command<CreateUserPayload> {
  static readonly COMMAND_NAME = "user.create";

  constructor(payload: CreateUserPayload, correlationId?: string) {
    super(CreateUserCommand.COMMAND_NAME, payload, correlationId);
  }
}
```

### Query Template:

```typescript
import { Query } from "./query";

export interface GetUserByIdPayload {
  readonly userId: string;
}

export class GetUserByIdQuery extends Query<GetUserByIdPayload> {
  static readonly QUERY_NAME = "user.get_by_id";

  constructor(payload: GetUserByIdPayload) {
    super(GetUserByIdQuery.QUERY_NAME, payload);
  }
}
```

---

## Step 2: Create Handler Class

### CommandHandler Template:

```typescript
import { CommandHandler } from "./command-handler";
import { CreateUserCommand } from "./create-user-command";
import { Result } from "../result";

export class CreateUserCommandHandler extends CommandHandler<CreateUserCommand, Result<string>> {
  subscribedTo(): string {
    return CreateUserCommand.COMMAND_NAME;
  }

  async handle(command: CreateUserCommand): Promise<Result<string>> {
    const { email, name } = command.payload;
    // Perform domain logic or call DAO / Repository
    return Result.success("user-123");
  }
}
```

---

## Step 3: Register with Bus

Register the handler with `InMemoryCommandBus` or `InMemoryQueryBus`:

```typescript
import { InMemoryCommandBus } from "@schorts/shared-kernel/cqrs";

const commandBus = new InMemoryCommandBus();
const handler = new CreateUserCommandHandler();
commandBus.register(CreateUserCommand.COMMAND_NAME, handler);

const result = await commandBus.dispatch(new CreateUserCommand({ email: "test@example.com", name: "Alice" }));
```

---

## Step 4: Update Exports

Ensure exports are added in `src/cqrs/index.ts` and `src/index.ts`.
