import type { DomainEvent } from "../domain-events";
import type { EventBus, EventStore } from "../event-bus";
import type {
  DomainEventSource,
  UnitOfWork,
  UnitOfWorkPostCommitHook,
} from "./unit-of-work";

export interface TransactionalOutboxOptions {
  /** Durable/pending event store where domain event primitives are staged during `commit()`. */
  eventStore?: EventStore | undefined;
  /** Event bus where committed domain events are published after `commit()` succeeds. */
  eventBus?: EventBus | undefined;
  /**
   * Whether post-commit `eventBus.publishMany` errors should be thrown to the caller.
   * Defaults to `false` when `eventStore` is configured (events remain safely staged in the outbox store for replay),
   * and `true` when only `eventBus` is configured.
   */
  throwOnPublishError?: boolean | undefined;
  /** Optional callback invoked if post-commit publishing fails. */
  onPublishError?: ((error: unknown, events: ReadonlyArray<DomainEvent>) => void) | undefined;
}

interface OutboxState {
  sources: Set<DomainEventSource>;
  stagedEvents: DomainEvent[];
  postCommitHooks: UnitOfWorkPostCommitHook[];
  committedEvents: DomainEvent[] | undefined;
  postCommitExecuted: boolean;
}

interface HookableUnitOfWork extends UnitOfWork {
  onCommit?: (hook: () => void | Promise<void>) => void;
  onRollback?: (hook: () => void | Promise<void>) => void;
}

export class TransactionalOutboxProcessor {
  private readonly states = new WeakMap<UnitOfWork, OutboxState>();

  constructor(private readonly options: TransactionalOutboxOptions = {}) {}

  attach(uow: UnitOfWork): UnitOfWork {
    if (this.states.has(uow)) {
      return uow;
    }

    const state: OutboxState = {
      sources: new Set(),
      stagedEvents: [],
      postCommitHooks: [],
      committedEvents: undefined,
      postCommitExecuted: false,
    };
    this.states.set(uow, state);

    uow.collectEventsFrom = (sourceOrSources: DomainEventSource | ReadonlyArray<DomainEventSource>) => {
      const list = Array.isArray(sourceOrSources)
        ? sourceOrSources
        : [sourceOrSources as DomainEventSource];
      for (const source of list) {
        state.sources.add(source);
        const pulled = source.pullDomainEvents();
        if (pulled.length > 0) {
          state.stagedEvents.push(...pulled);
        }
      }
    };

    uow.stageEvents = (events: DomainEvent | ReadonlyArray<DomainEvent>) => {
      const list = Array.isArray(events) ? events : [events as DomainEvent];
      state.stagedEvents.push(...list);
    };

    uow.getStagedEvents = () => {
      this.drainTrackedSources(state);
      return [...state.stagedEvents];
    };

    uow.onPostCommit = (hook: UnitOfWorkPostCommitHook) => {
      state.postCommitHooks.push(hook);
    };

    const stageIntoOutboxOnCommit = async () => {
      this.drainTrackedSources(state);
      const eventsToCommit = state.stagedEvents.splice(0);
      state.committedEvents = eventsToCommit;

      if (this.options.eventStore) {
        for (const event of eventsToCommit) {
          await this.options.eventStore.save(event.toPrimitives());
        }
      }

      for (const source of state.sources) {
        source.markChangesCommitted?.();
      }
      state.sources.clear();
    };

    const cleanupOnRollback = () => {
      this.drainTrackedSources(state);
      state.sources.clear();
      state.stagedEvents.length = 0;
      state.postCommitHooks.length = 0;
      state.committedEvents = undefined;
    };

    const hookable = uow as HookableUnitOfWork;
    const originalCommit = uow.commit.bind(uow);
    const originalRollback = uow.rollback.bind(uow);

    if (typeof hookable.onCommit === "function" && typeof hookable.onRollback === "function") {
      hookable.onCommit(stageIntoOutboxOnCommit);
      hookable.onRollback(cleanupOnRollback);
      uow.commit = async () => {
        await originalCommit();
        await this.executePostCommit(uow);
      };
    } else {
      uow.commit = async () => {
        await stageIntoOutboxOnCommit();
        await originalCommit();
        await this.executePostCommit(uow);
      };
      uow.rollback = async () => {
        try {
          await originalRollback();
        } finally {
          cleanupOnRollback();
        }
      };
    }

    return uow;
  }

  async executePostCommit(uow: UnitOfWork): Promise<void> {
    const state = this.states.get(uow);
    if (!state || state.postCommitExecuted) {
      return;
    }

    if (state.committedEvents === undefined) {
      this.drainTrackedSources(state);
      state.committedEvents = state.stagedEvents.splice(0);
      if (this.options.eventStore) {
        for (const event of state.committedEvents) {
          await this.options.eventStore.save(event.toPrimitives());
        }
      }
      for (const source of state.sources) {
        source.markChangesCommitted?.();
      }
      state.sources.clear();
    }

    state.postCommitExecuted = true;
    const committedEvents = state.committedEvents;
    const hooks = state.postCommitHooks.splice(0);

    for (const hook of hooks) {
      await hook(committedEvents);
    }

    if (this.options.eventBus && committedEvents.length > 0) {
      const shouldThrow =
        this.options.throwOnPublishError ?? (this.options.eventStore === undefined);
      try {
        await this.options.eventBus.publishMany(committedEvents);
      } catch (error) {
        this.options.onPublishError?.(error, committedEvents);
        if (shouldThrow) {
          throw error;
        }
      }
    }
  }

  async flush(): Promise<void> {
    if (this.options.eventBus) {
      await this.options.eventBus.replay();
    }
  }

  private drainTrackedSources(state: OutboxState): void {
    for (const source of state.sources) {
      const pulled = source.pullDomainEvents();
      if (pulled.length > 0) {
        state.stagedEvents.push(...pulled);
      }
    }
  }
}
