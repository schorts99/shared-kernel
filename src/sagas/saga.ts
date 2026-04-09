import { DomainEvent } from "../domain-events";
import { EventSubscriber } from "../event-bus";
import { Command, CommandBus } from "../cqrs";
import { SagaStateStore, SagaStatus } from "./saga-state-store";

export type SagaCompensationAction = () => Promise<void>;

export type SagaExecutionContext<Schema extends Record<string, any>> = {
  state: Schema;
  completeStep: (stepId: string, compensation?: SagaCompensationAction) => void;
  dispatch: <R = void>(command: Command) => Promise<R>;
  updateState: (nextState: Schema) => void;
};

export abstract class Saga<Schema extends Record<string, any> = {}>
  implements EventSubscriber<DomainEvent, true> {
  private handlers = new Map<string, (event: DomainEvent, context: SagaExecutionContext<Schema>) => Promise<void>>();
  private completedSteps: string[] = [];
  private compensationActions = new Map<string, SagaCompensationAction>();
  private currentState: Schema;

  constructor(
    protected readonly commandBus: CommandBus<true>,
    protected readonly stateStore: SagaStateStore<Schema, true>,
  ) {
    this.currentState = this.getInitialState();
    this.configure();
  }

  protected abstract getInitialState(): Schema;
  protected abstract getSagaId(event: DomainEvent): string;
  protected abstract configure(): void;

  protected on<Event extends DomainEvent>(
    eventName: string,
    handler: (event: Event, context: SagaExecutionContext<Schema>) => Promise<void>,
  ): void {
    this.handlers.set(eventName, handler as (event: DomainEvent, context: SagaExecutionContext<Schema>) => Promise<void>);
  }

  async handle(event: DomainEvent): Promise<void> {
    const sagaId = this.getSagaId(event);
    const persisted = await this.stateStore.load(sagaId);
    const state = persisted?.data ?? this.getInitialState();
    const completedSteps = persisted?.completedSteps ?? [];
    const processedEventIds = persisted?.processedEventIds ?? [];
    const handler = this.handlers.get(event.getEventName());

    if (processedEventIds.includes(event.id)) {
      return;
    }

    if (!handler) {
      return;
    }

    this.currentState = state;
    this.completedSteps = completedSteps;
    this.compensationActions.clear();

    try {
      await handler(event, {
        state: this.currentState,
        completeStep: (stepId, compensation) => this.completeStep(stepId, compensation),
        dispatch: command => this.commandBus.dispatch(command),
        updateState: nextState => {
          this.currentState = nextState;
        },
      });

      await this.saveState(sagaId, "pending", event.id);
    } catch (error) {
      await this.rollback();
      await this.saveState(sagaId, "failed", event.id);
      throw error;
    }
  }

  protected async completeSaga(sagaId: string, eventId?: string): Promise<void> {
    await this.saveState(sagaId, "completed", eventId);
  }

  protected completeStep(stepId: string, compensation?: SagaCompensationAction): void {
    if (!this.completedSteps.includes(stepId)) {
      this.completedSteps.push(stepId);
    }

    if (compensation) {
      this.compensationActions.set(stepId, compensation);
    }
  }

  private async rollback(): Promise<void> {
    const compensationEntries = Array.from(this.compensationActions.entries())
      .filter(([stepId]) => this.completedSteps.includes(stepId))
      .reverse();

    for (const [, compensation] of compensationEntries) {
      await compensation();
    }
  }

  private async saveState(sagaId: string, status: SagaStatus, eventId?: string): Promise<void> {
    const processedEventIds = eventId ? [eventId] : [];
    const persisted = await this.stateStore.load(sagaId);
    const allProcessedEventIds = [...(persisted?.processedEventIds ?? []), ...processedEventIds];

    await this.stateStore.save(sagaId, {
      status,
      completedSteps: this.completedSteps,
      processedEventIds: allProcessedEventIds,
      data: this.currentState,
    });
  }

  getSubscribedEventNames(): string[] {
    return Array.from(this.handlers.keys());
  }
}
