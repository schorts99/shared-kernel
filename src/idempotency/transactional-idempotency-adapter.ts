import type { UnitOfWork } from "../unit-of-work/unit-of-work";
import type { DomainEventPrimitives } from "../domain-events";

export interface CommittedIdempotencyRecord {
  result: unknown;
  events: DomainEventPrimitives[];
}

export type CommitResolution =
  | { status: "committed"; record: CommittedIdempotencyRecord }
  | { status: "not-committed" }
  | { status: "unknown" };

export interface TransactionalIdempotencyAdapter {
  /**
   * Atomically claims a key in the supplied transaction before application side effects.
   * A conflicting claimant must wait or fail, never independently execute the same key.
   * Returns a prior committed record, or undefined for a new claim.
   */
  claim(unitOfWork: UnitOfWork, key: string): Promise<CommittedIdempotencyRecord | undefined>;
  /** Persists the result and events in the SAME transaction as application changes. */
  record(unitOfWork: UnitOfWork, key: string, record: CommittedIdempotencyRecord): Promise<void>;
  /**
   * Uses an authoritative read after commit acknowledgment failure.
   * not-committed guarantees that the original transaction cannot subsequently commit;
   * absence from a stale replica is not sufficient. Uncertainty must return unknown.
   */
  resolve(key: string): Promise<CommitResolution>;
}
