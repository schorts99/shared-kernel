export class HTTPException extends Error {
  constructor(
    readonly message: string,
    readonly statusCode: number,
  ) {
    super()
  }
}
