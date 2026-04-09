import { MaybePromise } from "../types";

export type SagaStatus = "pending" | "completed" | "failed";

export type SagaInstanceState<Schema = {}> = {
  status: SagaStatus;
  completedSteps: string[];
  processedEventIds: string[];
  data: Schema;
};

export interface SagaStateStore<Schema = {}, IsAsync extends boolean = false> {
  save(sagaId: string, state: SagaInstanceState<Schema>): MaybePromise<IsAsync, void>;
  load(sagaId: string): MaybePromise<IsAsync, SagaInstanceState<Schema> | undefined>;
  delete(sagaId: string): MaybePromise<IsAsync, void>;
  all(): MaybePromise<IsAsync, Array<{ sagaId: string; state: SagaInstanceState<Schema> }>>;
}
