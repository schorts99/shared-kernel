import { SagaInstanceState, SagaStateStore } from "../saga-state-store";

export class InMemorySagaStateStore<Schema extends Record<string, any> = {}>
  implements SagaStateStore<Schema> {
  private readonly store = new Map<string, SagaInstanceState<Schema>>();

  async save(sagaId: string, state: SagaInstanceState<Schema>): Promise<void> {
    this.store.set(sagaId, state);
  }

  async load(sagaId: string): Promise<SagaInstanceState<Schema> | undefined> {
    return this.store.get(sagaId);
  }

  async delete(sagaId: string): Promise<void> {
    this.store.delete(sagaId);
  }

  async all(): Promise<Array<{ sagaId: string; state: SagaInstanceState<Schema> }>> {
    return Array.from(this.store.entries()).map(([sagaId, state]) => ({ sagaId, state }));
  }
}
