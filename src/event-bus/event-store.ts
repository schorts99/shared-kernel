import { DomainEventPrimitives } from "../domain-events";
import { MaybePromise } from "../types";

export interface EventStore<IsAsync extends boolean = false> {
  save(primitives: DomainEventPrimitives): MaybePromise<IsAsync, void>;
  all(): MaybePromise<IsAsync, DomainEventPrimitives[]>;
  delete(id: string): MaybePromise<IsAsync, void>;
  requeue(primitives: DomainEventPrimitives): MaybePromise<IsAsync, void>;
  clear(): MaybePromise<IsAsync, void>;
}
