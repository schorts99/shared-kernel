import type { DomainEvent } from "../../domain-events";
import type { Logger } from "../../logger";
import {
  TransactionalOutboxProcessor,
  type TransactionalOutboxOptions,
} from "../transactional-outbox";
import type {
  DomainEventSource,
  UnitOfWork,
  UnitOfWorkPostCommitHook,
} from "../unit-of-work";
import { AsyncUnitOfWorkRunner } from "../unit-of-work-runner";

export type UnitOfWorkHook = () => void | Promise<void>;

export type InMemoryUnitOfWorkOptions = TransactionalOutboxOptions;

export class InMemoryUnitOfWork implements UnitOfWork {
  private active = false;
  private readonly commitHooks: UnitOfWorkHook[] = [];
  private readonly rollbackHooks: UnitOfWorkHook[] = [];
  private readonly outboxProcessor: TransactionalOutboxProcessor;

  collectEventsFrom!: (source: DomainEventSource | ReadonlyArray<DomainEventSource>) => void;
  stageEvents!: (events: DomainEvent | ReadonlyArray<DomainEvent>) => void;
  getStagedEvents!: () => ReadonlyArray<DomainEvent>;
  onPostCommit!: (hook: UnitOfWorkPostCommitHook) => void;

  constructor(options: InMemoryUnitOfWorkOptions = {}) {
    this.outboxProcessor = new TransactionalOutboxProcessor(options);
    this.outboxProcessor.attach(this);
  }

  async begin(): Promise<void> {
    if (this.active) {
      throw new Error("Transaction is already active");
    }
    this.active = true;
  }

  onCommit(hook: UnitOfWorkHook): void {
    this.commitHooks.push(hook);
  }

  onRollback(hook: UnitOfWorkHook): void {
    this.rollbackHooks.push(hook);
  }

  async commit(): Promise<void> {
    if (!this.active) {
      throw new Error("Cannot commit an inactive transaction");
    }
    this.active = false;
    try {
      for (const hook of this.commitHooks.splice(0)) {
        await hook();
      }
    } finally {
      this.rollbackHooks.length = 0;
    }
  }

  async rollback(): Promise<void> {
    if (!this.active) {
      return;
    }
    this.active = false;
    try {
      for (const hook of this.rollbackHooks.splice(0).reverse()) {
        await hook();
      }
    } finally {
      this.commitHooks.length = 0;
    }
  }

  isActive(): boolean {
    return this.active;
  }
}

export class InMemoryUnitOfWorkRunner extends AsyncUnitOfWorkRunner {
  constructor(
    private readonly options: InMemoryUnitOfWorkOptions = {},
    logger?: Logger,
  ) {
    super(logger, options);
  }

  protected createUnitOfWork(): UnitOfWork {
    return new InMemoryUnitOfWork(this.options);
  }
}
