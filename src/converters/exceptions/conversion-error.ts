export class ConversionError extends Error {
  readonly code: string;
  readonly details: Record<string, unknown> | undefined;

  constructor(
    message: string,
    code: string = "CONVERSION_FAILED",
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "ConversionError";
    this.code = code;
    this.details = details;
  }
}
