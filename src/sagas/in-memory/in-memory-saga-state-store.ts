import { SagaInstanceState, SagaStateStore } from "../saga-state-store.js";
import { cloneValue } from "../../utils/object.js";

export interface InMemorySagaStateStoreOptions<Schema extends Record<string, any> = {}> {
  /** Maximum number of processed event IDs retained per saga instance (default 1,000). */
  maxProcessedEventsPerSaga?: number;
  /** Custom state copier; defaults to domain-aware deep clone (`cloneValue`). */
  cloneState?: (state: SagaInstanceState<Schema>) => SagaInstanceState<Schema>;
}

export class InMemorySagaStateStore<Schema extends Record<string, any> = {}>
  implements SagaStateStore<Schema> {
  private readonly store = new Map<string, SagaInstanceState<Schema>>();
  private readonly maxProcessedEventsPerSaga: number;
  private readonly clone: (state: SagaInstanceState<Schema>) => SagaInstanceState<Schema>;

  constructor(options: InMemorySagaStateStoreOptions<Schema> = {}) {
    const maxProcessed = options.maxProcessedEventsPerSaga ?? 1_000;
    if (!Number.isSafeInteger(maxProcessed) || maxProcessed < 1) {
      throw new RangeError("maxProcessedEventsPerSaga must be a positive safe integer");
    }
    this.maxProcessedEventsPerSaga = maxProcessed;
    this.clone = options.cloneState ?? (state => cloneValue(state));
  }

  async save(sagaId: string, state: SagaInstanceState<Schema>): Promise<void> {
    const cloned = this.clone(state);
    if (cloned.processedEventIds.length > this.maxProcessedEventsPerSaga) {
      cloned.processedEventIds = cloned.processedEventIds.slice(-this.maxProcessedEventsPerSaga);
    }
    this.store.set(sagaId, cloned);
  }

  async load(sagaId: string): Promise<SagaInstanceState<Schema> | undefined> {
    const existing = this.store.get(sagaId);
    return existing ? this.clone(existing) : undefined;
  }

  async delete(sagaId: string): Promise<void> {
    this.store.delete(sagaId);
  }

  async all(): Promise<Array<{ sagaId: string; state: SagaInstanceState<Schema> }>> {
    return Array.from(this.store.entries()).map(([sagaId, state]) => ({
      sagaId,
      state: this.clone(state),
    }));
  }
}
