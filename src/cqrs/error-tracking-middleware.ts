import { CommandBusMiddleware, CommandBusContext } from "./command-bus.js";
import { QueryBusMiddleware, QueryBusContext } from "./query-bus.js";
import { Command } from "./command.js";
import { Query } from "./query.js";
import { DomainEvent } from "../domain-events/index.js";
import { EventBusContext, EventBusMiddleware } from "../event-bus/index.js";
import { ErrorTracker } from "../error-tracking/index.js";

export class ErrorTrackingMiddleware
  implements CommandBusMiddleware, QueryBusMiddleware, EventBusMiddleware {
  constructor(private readonly tracker: ErrorTracker) {}

  async onError(
    requestOrEvent: Command | Query | DomainEvent,
    error: Error,
    context: CommandBusContext | QueryBusContext | EventBusContext,
  ): Promise<void> {
    const isEvent = "getEventName" in requestOrEvent;
    const isCommand = !isEvent && "events" in context;
    const requestType = isEvent ? "event" : isCommand ? "command" : "query";
    const typeName = isEvent
      ? requestOrEvent.getEventName()
      : requestOrEvent.getType();

    const trackingContext = {
      ...context.metadata,
      requestType,
      typeName,
      correlationId: context.correlationId,
      startTime: context.startTime.toISOString(),
      payload: requestOrEvent.toPrimitives?.().payload ?? {},
    };

    await this.tracker.track(
      error,
      trackingContext,
      `Failed to execute ${requestType}: ${typeName}`,
    );
  }
}
