export class HTTPException extends Error {
  constructor(
    readonly statusCode: number,
    readonly body: any,
  ) {
    super()
  }
}
