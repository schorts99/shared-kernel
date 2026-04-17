export type SagaStatus = "pending" | "completed" | "failed";

export type SagaInstanceState<Schema = {}> = {
  status: SagaStatus;
  completedSteps: string[];
  processedEventIds: string[];
  data: Schema;
};

export interface SagaStateStore<Schema = {}> {
  save(sagaId: string, state: SagaInstanceState<Schema>): Promise<void>;
  load(sagaId: string): Promise<SagaInstanceState<Schema> | undefined>;
  delete(sagaId: string): Promise<void>;
  all(): Promise<Array<{ sagaId: string; state: SagaInstanceState<Schema> }>>;
}
