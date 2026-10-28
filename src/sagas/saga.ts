import { DomainEvent } from "../domain-events";
import { EventSubscriber, EventSubscriberContext } from "../event-bus";
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
  implements EventSubscriber<DomainEvent> {
  private handlers = new Map<string, (event: DomainEvent, context: SagaExecutionContext<Schema>) => Promise<void>>();
  private completedSteps: string[] = [];
  private compensationActions = new Map<string, SagaCompensationAction>();
  private currentState: Schema;
  private executionQueue: Promise<void> = Promise.resolve();
  private activeSagaId: string | undefined;
  private completed = false;

  constructor(
    protected readonly commandBus: CommandBus,
    protected readonly stateStore: SagaStateStore<Schema>,
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

  handle(event: DomainEvent, _context?: EventSubscriberContext): Promise<void> {
    const execution = this.executionQueue.then(() => this.execute(event));
    this.executionQueue = execution.then(() => undefined, () => undefined);

    return execution;
  }

  private async execute(event: DomainEvent): Promise<void> {
    const sagaId = this.getSagaId(event);
    const persisted = await this.stateStore.load(sagaId);
    const state = persisted?.data ?? this.getInitialState();
    const completedSteps = [...(persisted?.completedSteps ?? [])];
    const processedEventIds = persisted?.processedEventIds ?? [];
    const handler = this.handlers.get(event.getEventName());

    if (persisted?.status === "completed" || processedEventIds.includes(event.id)) {
      return;
    }

    if (!handler) {
      return;
    }

    this.currentState = state;
    this.completedSteps = completedSteps;
    this.compensationActions.clear();
    this.activeSagaId = sagaId;
    this.completed = false;

    try {
      const saga = this;
      await handler(event, {
        get state() {
          return saga.currentState;
        },
        completeStep: (stepId, compensation) => this.completeStep(stepId, compensation),
        dispatch: command => this.commandBus.dispatch(command),
        updateState: nextState => {
          this.currentState = nextState;
        },
      });

      await this.saveState(sagaId, this.completed ? "completed" : "pending", event.id);
    } catch (error) {
      const errors: unknown[] = [error];

      try {
        await this.rollback();
      } catch (rollbackError) {
        errors.push(rollbackError);
      }

      try {
        await this.saveState(sagaId, "failed");
      } catch (saveError) {
        errors.push(saveError);
      }

      if (errors.length > 1) {
        throw new AggregateError(errors, "Saga execution and recovery failed");
      }

      throw error;
    } finally {
      this.activeSagaId = undefined;
      this.compensationActions.clear();
    }
  }

  subscribedTo(): string[] {
    return Array.from(this.handlers.keys());
  }

  getName(): string {
    return this.constructor.name;
  }

  protected async completeSaga(sagaId: string, eventId?: string): Promise<void> {
    if (this.activeSagaId !== undefined) {
      if (sagaId !== this.activeSagaId) {
        throw new Error("Cannot complete a different saga during execution");
      }

      this.completed = true;

      return;
    }

    const persisted = await this.stateStore.load(sagaId);

    await this.stateStore.save(sagaId, {
      status: "completed",
      data: persisted?.data ?? this.getInitialState(),
      completedSteps: [...(persisted?.completedSteps ?? [])],
      processedEventIds: [...new Set([
        ...(persisted?.processedEventIds ?? []),
        ...(eventId === undefined ? [] : [eventId]),
      ])],
    });
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

    const errors: unknown[] = [];

    for (const [stepId, compensation] of compensationEntries) {
      try {
        await compensation();
        this.completedSteps = this.completedSteps.filter(completedStep => completedStep !== stepId);
      } catch (error) {
        errors.push(error);
      }
    }

    if (errors.length > 0) {
      throw new AggregateError(errors, "Saga compensation failed");
    }
  }

  private async saveState(sagaId: string, status: SagaStatus, eventId?: string): Promise<void> {
    const processedEventIds = eventId ? [eventId] : [];
    const persisted = await this.stateStore.load(sagaId);
    const allProcessedEventIds = [...new Set([...(persisted?.processedEventIds ?? []), ...processedEventIds])];

    await this.stateStore.save(sagaId, {
      status,
      completedSteps: [...this.completedSteps],
      processedEventIds: allProcessedEventIds,
      data: this.currentState,
    });
  }
}
