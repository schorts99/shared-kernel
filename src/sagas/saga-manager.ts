import { EventBus } from "../event-bus";
import { Saga } from "./saga";

export class SagaManager {
  constructor(private readonly eventBus: EventBus<true>) {}

  register<S extends Saga<any>>(saga: S): void {
    for (const eventName of saga.getSubscribedEventNames()) {
      this.eventBus.subscribe(eventName, saga);
    }
  }
}
