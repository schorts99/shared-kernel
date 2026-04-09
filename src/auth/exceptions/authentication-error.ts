/**
 * Error thrown when authentication fails
 */
export class AuthenticationError extends Error {
  readonly code: string;
  readonly details: Record<string, any> | undefined;

  constructor(
    message: string,
    code: string = "AUTHENTICATION_FAILED",
    details?: Record<string, any>
  ) {
    super(message);
    this.name = "AuthenticationError";
    this.code = code;
    this.details = details;
  }
}
