import { EventBus } from "../event-bus";
import { Saga } from "./saga";

export class SagaManager {
  constructor(private readonly eventBus: EventBus) { }

  register<S extends Saga<any>>(saga: S): void {
    for (const eventName of saga.subscribedTo()) {
      this.eventBus.subscribe(eventName, saga);
    }
  }
}
