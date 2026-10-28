import { DomainEventPrimitives } from "../../domain-events";
import { EventStore } from "../event-store";
import { getExpirationTime } from "../../utils/expiration";

export interface InMemoryEventStoreOptions {
  /** Duplicate-suppression window in milliseconds; defaults to 24 hours. */
  processedTtl?: number;
  /** Oldest processed IDs are evicted beyond this limit (default 10,000). */
  maxProcessedEvents?: number;
  /** New pending events reject at capacity (default 10,000); pending delivery is never evicted. */
  maxPendingEvents?: number;
}

export class InMemoryEventStore implements EventStore {
  private readonly events = new Map<string, DomainEventPrimitives>();
  private readonly processedEventIds = new Map<string, number>();
  private readonly acknowledgments = new Map<string, Set<string>>();
  private readonly options: Required<InMemoryEventStoreOptions>;

  constructor(options: InMemoryEventStoreOptions = {}) {
    this.options = {
      processedTtl: options.processedTtl ?? 24 * 60 * 60 * 1000,
      maxProcessedEvents: options.maxProcessedEvents ?? 10_000,
      maxPendingEvents: options.maxPendingEvents ?? 10_000,
    };
    getExpirationTime(this.options.processedTtl);
    for (const limit of [this.options.maxProcessedEvents, this.options.maxPendingEvents]) {
      if (!Number.isSafeInteger(limit) || limit < 1) throw new RangeError("Event store limits must be positive safe integers");
    }
  }

  async prune(): Promise<number> {
    return this.pruneExpired();
  }

  private pruneExpired(): number {
    let removed = 0;
    for (const [id, expiresAt] of this.processedEventIds) {
      if (Date.now() >= expiresAt) {
        this.processedEventIds.delete(id);
        removed++;
      }
    }
    return removed;
  }

  async isAcknowledged(eventId: string, subscriberId: string): Promise<boolean> {
    return this.acknowledgments.get(eventId)?.has(subscriberId) ?? false;
  }

  async acknowledge(eventId: string, subscriberId: string): Promise<void> {
    if (!this.events.has(eventId)) throw new Error("Cannot acknowledge an event that is not pending");
    const subscribers = this.acknowledgments.get(eventId) ?? new Set<string>();
    subscribers.add(subscriberId);
    this.acknowledgments.set(eventId, subscribers);
  }

  async save(primitives: DomainEventPrimitives) {
    this.pruneExpired();
    if (!this.processedEventIds.has(primitives.id)) {
      if (!this.events.has(primitives.id) && this.events.size >= this.options.maxPendingEvents) {
        throw new Error("Pending event store capacity exceeded");
      }
      this.events.set(primitives.id, primitives);
    }
  }

  async all() {
    return [...this.events.values()];
  }

  async delete(id: string) {
    this.events.delete(id);
    this.acknowledgments.delete(id);
    this.pruneExpired();
    this.processedEventIds.delete(id);
    if (this.processedEventIds.size >= this.options.maxProcessedEvents) {
      const oldest = this.processedEventIds.keys().next();
      if (!oldest.done) this.processedEventIds.delete(oldest.value);
    }
    this.processedEventIds.set(id, getExpirationTime(this.options.processedTtl)!);
  }

  async requeue(primitives: DomainEventPrimitives) {
    await this.save(primitives);
  }

  async clear() {
    this.events.clear();
    this.processedEventIds.clear();
    this.acknowledgments.clear();
  }

  async isProcessed(id: string): Promise<boolean> {
    this.pruneExpired();
    return this.processedEventIds.has(id);
  }
}
