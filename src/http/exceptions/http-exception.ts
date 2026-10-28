export class HTTPException extends Error {
  constructor(
    readonly statusCode: number,
    readonly body: any,
    message?: string,
  ) {
    super(message ?? `HTTP Error ${statusCode}`);
    this.name = "HTTPException";
  }
}
