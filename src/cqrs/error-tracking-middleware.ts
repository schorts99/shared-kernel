import { CommandBusMiddleware, CommandBusContext } from "./command-bus";
import { QueryBusMiddleware, QueryBusContext } from "./query-bus";
import { Command } from "./command";
import { Query } from "./query";
import { ErrorTracker } from "../error-tracking";

export class ErrorTrackingMiddleware implements CommandBusMiddleware, QueryBusMiddleware {
  constructor(private readonly tracker: ErrorTracker) { }

  async onError(
    request: Command | Query,
    error: Error,
    context: CommandBusContext | QueryBusContext
  ): Promise<void> {
    const isCommand = "events" in context;
    const requestType = isCommand ? "command" : "query";
    const typeName = request.getType();

    const trackingContext = {
      ...context.metadata,
      requestType,
      typeName,
      correlationId: context.correlationId,
      startTime: context.startTime.toISOString(),
      payload: request.toPrimitives?.().payload ?? {},
    };

    await this.tracker.track(
      error,
      trackingContext,
      `Failed to execute ${requestType}: ${typeName}`
    );
  }
}
