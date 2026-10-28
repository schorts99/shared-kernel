import { EventBus } from "../event-bus/index.js";
import { Saga } from "./saga.js";

export class SagaManager {
  private readonly registeredSagas = new Set<Saga<any>>();

  constructor(private readonly eventBus: EventBus) {}

  register<S extends Saga<any>>(saga: S): void {
    this.registeredSagas.add(saga);
    for (const eventName of saga.subscribedTo()) {
      this.eventBus.subscribe(eventName, saga);
    }
  }

  unregister<S extends Saga<any>>(saga: S): boolean {
    const wasRegistered = this.registeredSagas.delete(saga);
    for (const eventName of saga.subscribedTo()) {
      this.eventBus.unsubscribe(eventName, saga);
    }
    return wasRegistered;
  }

  getRegisteredSagas(): ReadonlyArray<Saga<any>> {
    return Array.from(this.registeredSagas);
  }
}
