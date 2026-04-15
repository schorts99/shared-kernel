export class QueryValidationError extends Error {
  readonly code: string;
  readonly details: Record<string, any> | undefined;

  constructor(
    message: string,
    code: string = "QUERY_VALIDATION_FAILED",
    details?: Record<string, any>
  ) {
    super(message);

    this.name = "QueryValidationError";
    this.code = code;
    this.details = details;
  }
}

export class QueryAuthorizationError extends Error {
  readonly code: string;
  readonly details: Record<string, any> | undefined;

  constructor(
    message: string,
    code: string = "QUERY_AUTHORIZATION_FAILED",
    details?: Record<string, any>
  ) {
    super(message);

    this.name = "QueryAuthorizationError";
    this.code = code;
    this.details = details;
  }
}

export class QueryExecutionError extends Error {
  readonly code: string;
  readonly details: Record<string, any> | undefined;

  constructor(
    message: string,
    code: string = "QUERY_EXECUTION_FAILED",
    details?: Record<string, any>
  ) {
    super(message);

    this.name = "QueryExecutionError";
    this.code = code;
    this.details = details;
  }
}
