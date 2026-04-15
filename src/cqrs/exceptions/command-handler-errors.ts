export class CommandValidationError extends Error {
  constructor(
    message: string,
    public readonly code: string = "COMMAND_VALIDATION_ERROR",
    public readonly context?: Record<string, any>
  ) {
    super(message);

    this.name = "CommandValidationError";

    Object.setPrototypeOf(this, CommandValidationError.prototype);
  }
}

export class CommandAuthorizationError extends Error {
  constructor(
    message: string,
    public readonly code: string = "COMMAND_AUTHORIZATION_ERROR",
    public readonly context?: Record<string, any>
  ) {
    super(message);

    this.name = "CommandAuthorizationError";

    Object.setPrototypeOf(this, CommandAuthorizationError.prototype);
  }
}

export class CommandExecutionError extends Error {
  constructor(
    message: string,
    public readonly code: string = "COMMAND_EXECUTION_ERROR",
    public readonly context?: Record<string, any>
  ) {
    super(message);

    this.name = "CommandExecutionError";

    Object.setPrototypeOf(this, CommandExecutionError.prototype);
  }
}

export class CommandAlreadyProcessing extends Error {
  constructor(
    message: string,
    public readonly idempotencyKey: string,
    public readonly code: string = "COMMAND_ALREADY_PROCESSING"
  ) {
    super(message);

    this.name = "CommandAlreadyProcessing";

    Object.setPrototypeOf(this, CommandAlreadyProcessing.prototype);
  }
}

export class CommandMaxRetriesExceeded extends Error {
  constructor(
    message: string,
    public readonly retryCount: number,
    public readonly lastError: Error,
    public readonly code: string = "COMMAND_MAX_RETRIES_EXCEEDED"
  ) {
    super(message);

    this.name = "CommandMaxRetriesExceeded";

    Object.setPrototypeOf(this, CommandMaxRetriesExceeded.prototype);
  }
}
