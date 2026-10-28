import { DomainEvent } from "../domain-events";
import { EventSubscriber, EventSubscriberContext } from "../event-bus";
import { Command, CommandBus } from "../cqrs";
import {
  addWaitEdge,
  assertNoCycleWhenWaitingOn,
  getCurrentExecutionNode,
  getInFlightTaskOwner,
  registerInFlightTask,
  removeWaitEdge,
} from "../cqrs/bus-runtime";
import { SagaStateStore, SagaStatus } from "./saga-state-store";

export type SagaCompensationAction = () => Promise<void>;

export type SagaStepCompensationContext<Schema extends Record<string, any>> = {
  sagaId: string;
  state: Schema;
  event: DomainEvent;
  dispatch: <R = void>(command: Command) => Promise<R>;
  updateState: (nextState: Schema) => void;
};

export type SagaStepCompensation<Schema extends Record<string, any>> = (
  context: SagaStepCompensationContext<Schema>,
) => Promise<void> | void;

export interface SagaOptions {
  /** Maximum number of processed event IDs retained per saga instance (default 1,000). */
  maxProcessedEvents?: number;
}

export type SagaExecutionContext<Schema extends Record<string, any>> = {
  sagaId: string;
  state: Schema;
  completeStep: (stepId: string, compensation?: SagaCompensationAction) => void;
  completeSaga: () => void;
  dispatch: <R = void>(command: Command) => Promise<R>;
  updateState: (nextState: Schema) => void;
};

interface SagaExecutionFrame<Schema extends Record<string, any>> {
  sagaId: string;
  event: DomainEvent;
  state: Schema;
  completedSteps: string[];
  completed: boolean;
}

export abstract class Saga<Schema extends Record<string, any> = {}>
  implements EventSubscriber<DomainEvent> {
  private readonly handlers = new Map<
    string,
    (event: DomainEvent, context: SagaExecutionContext<Schema>) => Promise<void>
  >();
  private readonly stepCompensations = new Map<string, SagaStepCompensation<Schema>>();
  private readonly instanceCompensations = new Map<string, Map<string, SagaCompensationAction>>();
  private readonly executionQueues = new Map<string, Promise<void>>();
  private readonly activeFrames = new Map<string, SagaExecutionFrame<Schema>>();
  private currentSyncFrame: SagaExecutionFrame<Schema> | undefined;
  private readonly maxProcessedEvents: number;

  constructor(
    protected readonly commandBus: CommandBus,
    protected readonly stateStore: SagaStateStore<Schema>,
    options: SagaOptions = {},
  ) {
    const maxProcessed = options.maxProcessedEvents ?? 1_000;
    if (!Number.isSafeInteger(maxProcessed) || maxProcessed < 1) {
      throw new RangeError("maxProcessedEvents must be a positive safe integer");
    }
    this.maxProcessedEvents = maxProcessed;
    this.configure();
  }

  protected abstract getInitialState(): Schema;
  protected abstract getSagaId(event: DomainEvent): string;
  protected abstract configure(): void;

  protected on<Event extends DomainEvent>(
    eventName: string,
    handler: (event: Event, context: SagaExecutionContext<Schema>) => Promise<void>,
  ): void {
    this.handlers.set(
      eventName,
      handler as (event: DomainEvent, context: SagaExecutionContext<Schema>) => Promise<void>,
    );
  }

  protected registerStepCompensation(
    stepId: string,
    compensation: SagaStepCompensation<Schema>,
  ): void {
    this.stepCompensations.set(stepId, compensation);
  }

  async handle(event: DomainEvent, _context?: EventSubscriberContext): Promise<void> {
    const sagaId = this.getSagaId(event);
    const previous = this.executionQueues.get(sagaId) ?? Promise.resolve();
    const currentNode = getCurrentExecutionNode();
    const ownerNode = getInFlightTaskOwner(previous);
    if (currentNode && ownerNode) {
      assertNoCycleWhenWaitingOn(currentNode, ownerNode);
    }

    const waitAndExecute = async () => {
      if (currentNode && ownerNode) {
        addWaitEdge(currentNode, ownerNode);
      }
      try {
        await previous;
      } finally {
        if (currentNode && ownerNode) {
          removeWaitEdge(currentNode, ownerNode);
        }
      }
      return this.execute(sagaId, event);
    };

    const execution = waitAndExecute();
    const settled = execution.then(
      () => undefined,
      () => undefined,
    );
    registerInFlightTask(settled, currentNode);
    this.executionQueues.set(sagaId, settled);

    void settled.then(() => {
      if (this.executionQueues.get(sagaId) === settled) {
        this.executionQueues.delete(sagaId);
      }
    });

    return execution;
  }

  private async execute(sagaId: string, event: DomainEvent): Promise<void> {
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

    const frame: SagaExecutionFrame<Schema> = {
      sagaId,
      event,
      state,
      completedSteps,
      completed: false,
    };

    this.activeFrames.set(sagaId, frame);
    const previousSyncFrame = this.currentSyncFrame;
    this.currentSyncFrame = frame;

    try {
      await handler(event, {
        sagaId,
        get state() {
          return frame.state;
        },
        completeStep: (stepId, compensation) => this.recordStepInFrame(frame, stepId, compensation),
        completeSaga: () => {
          frame.completed = true;
        },
        dispatch: command => this.commandBus.dispatch(command),
        updateState: nextState => {
          frame.state = nextState;
        },
      });

      await this.saveState(frame, frame.completed ? "completed" : "pending", event.id);
      if (frame.completed) {
        this.instanceCompensations.delete(sagaId);
      }
    } catch (error) {
      const errors: unknown[] = [error];

      try {
        await this.rollback(frame);
      } catch (rollbackError) {
        errors.push(rollbackError);
      }

      try {
        await this.saveState(frame, "failed");
      } catch (saveError) {
        errors.push(saveError);
      } finally {
        this.instanceCompensations.delete(sagaId);
      }

      if (errors.length > 1) {
        throw new AggregateError(errors, "Saga execution and recovery failed");
      }

      throw error;
    } finally {
      this.currentSyncFrame = previousSyncFrame;
      this.activeFrames.delete(sagaId);
    }
  }

  subscribedTo(): string[] {
    return Array.from(this.handlers.keys());
  }

  getName(): string {
    return this.constructor.name;
  }

  protected async completeSaga(sagaId: string, eventId?: string): Promise<void> {
    const activeFrame = this.activeFrames.get(sagaId);
    if (activeFrame) {
      activeFrame.completed = true;
      return;
    }

    if (this.currentSyncFrame && this.currentSyncFrame.sagaId !== sagaId) {
      throw new Error("Cannot complete a different saga during execution");
    }

    const persisted = await this.stateStore.load(sagaId);
    const mergedProcessed = [
      ...new Set([
        ...(persisted?.processedEventIds ?? []),
        ...(eventId === undefined ? [] : [eventId]),
      ]),
    ].slice(-this.maxProcessedEvents);

    await this.stateStore.save(sagaId, {
      status: "completed",
      data: persisted?.data ?? this.getInitialState(),
      completedSteps: [...(persisted?.completedSteps ?? [])],
      processedEventIds: mergedProcessed,
    });
    this.instanceCompensations.delete(sagaId);
  }

  protected completeStep(stepId: string, compensation?: SagaCompensationAction): void {
    const frame =
      this.currentSyncFrame ??
      (this.activeFrames.size === 1 ? this.activeFrames.values().next().value : undefined);
    if (!frame) {
      throw new Error("completeStep must be called within an active saga execution");
    }
    this.recordStepInFrame(frame, stepId, compensation);
  }

  private recordStepInFrame(
    frame: SagaExecutionFrame<Schema>,
    stepId: string,
    compensation?: SagaCompensationAction,
  ): void {
    if (!frame.completedSteps.includes(stepId)) {
      frame.completedSteps.push(stepId);
    }

    if (compensation) {
      let stepMap = this.instanceCompensations.get(frame.sagaId);
      if (!stepMap) {
        stepMap = new Map<string, SagaCompensationAction>();
        this.instanceCompensations.set(frame.sagaId, stepMap);
      }
      stepMap.set(stepId, compensation);
    }
  }

  private async rollback(frame: SagaExecutionFrame<Schema>): Promise<void> {
    const stepsToCompensate = [...frame.completedSteps].reverse();
    const runtimeCompensations = this.instanceCompensations.get(frame.sagaId);
    const errors: unknown[] = [];

    for (const stepId of stepsToCompensate) {
      const runtimeCompensation = runtimeCompensations?.get(stepId);
      const declarativeCompensation = this.stepCompensations.get(stepId);

      if (!runtimeCompensation && !declarativeCompensation) {
        continue;
      }

      try {
        if (runtimeCompensation) {
          await runtimeCompensation();
        } else if (declarativeCompensation) {
          await declarativeCompensation({
            sagaId: frame.sagaId,
            get state() {
              return frame.state;
            },
            event: frame.event,
            dispatch: command => this.commandBus.dispatch(command),
            updateState: nextState => {
              frame.state = nextState;
            },
          });
        }
        frame.completedSteps = frame.completedSteps.filter(
          completedStep => completedStep !== stepId,
        );
        runtimeCompensations?.delete(stepId);
      } catch (error) {
        errors.push(error);
      }
    }

    if (errors.length > 0) {
      throw new AggregateError(errors, "Saga compensation failed");
    }
  }

  private async saveState(
    frame: SagaExecutionFrame<Schema>,
    status: SagaStatus,
    eventId?: string,
  ): Promise<void> {
    const processedEventIds = eventId ? [eventId] : [];
    const persisted = await this.stateStore.load(frame.sagaId);
    const allProcessedEventIds = [
      ...new Set([...(persisted?.processedEventIds ?? []), ...processedEventIds]),
    ].slice(-this.maxProcessedEvents);

    await this.stateStore.save(frame.sagaId, {
      status,
      completedSteps: [...frame.completedSteps],
      processedEventIds: allProcessedEventIds,
      data: frame.state,
    });
  }
}
