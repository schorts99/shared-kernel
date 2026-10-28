import type { DomainEvent } from "../domain-events";

export interface DomainEventSource {
  pullDomainEvents(): ReadonlyArray<DomainEvent>;
  markChangesCommitted?(): void;
}

export type UnitOfWorkPostCommitHook = (
  events: ReadonlyArray<DomainEvent>,
) => void | Promise<void>;

export interface UnitOfWork {
  begin(): Promise<void>;

  commit(): Promise<void>;

  rollback(): Promise<void>;

  isActive(): boolean;

  collectEventsFrom?(source: DomainEventSource | ReadonlyArray<DomainEventSource>): void;

  stageEvents?(events: DomainEvent | ReadonlyArray<DomainEvent>): void;

  getStagedEvents?(): ReadonlyArray<DomainEvent>;

  onPostCommit?(hook: UnitOfWorkPostCommitHook): void;
}
