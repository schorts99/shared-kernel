export class Result<T, E = Error> {
  private readonly _isSuccess: boolean;
  private readonly _value: T | undefined;
  private readonly _error: E | undefined;

  private constructor(isSuccess: boolean, value: T | undefined, error: E | undefined) {
    this._isSuccess = isSuccess;
    this._value = value;
    this._error = error;
  }

  static success<T, E = Error>(value: T): Result<T, E> {
    return new Result<T, E>(true, value, undefined);
  }

  static failure<T, E = Error>(error: E): Result<T, E> {
    return new Result<T, E>(false, undefined, error);
  }

  static error<T>(error: Error): Result<T, Error> {
    return Result.failure<T, Error>(error);
  }

  static combine<T, E = Error>(results: Result<T, E>[]): Result<T[], E> {
    const values: T[] = [];
    for (const result of results) {
      if (result.isFailure()) return Result.failure(result.error);
      values.push(result.value);
    }
    return Result.success(values);
  }

  isSuccess(): boolean {
    return this._isSuccess;
  }

  isFailure(): boolean {
    return !this._isSuccess;
  }

  get value(): T {
    if (this.isFailure()) {
      throw this._error instanceof Error ? this._error : new Error(`Result failure: ${String(this._error)}`);
    }

    return this._value!;
  }

  get error(): E {
    if (this.isSuccess()) throw new Error("Cannot get error from a success result");

    return this._error!;
  }

  getValue(): T | undefined {
    return this._value;
  }

  getError(): E | undefined {
    return this._error;
  }

  map<U>(fn: (value: T) => U): Result<U, E> {
    return this.isSuccess() ? Result.success(fn(this.value)) : Result.failure(this.error);
  }

  flatMap<U>(fn: (value: T) => Result<U, E>): Result<U, E> {
    return this.isSuccess() ? fn(this.value) : Result.failure(this.error);
  }

  mapError<F>(fn: (error: E) => F): Result<T, F> {
    return this.isFailure() ? Result.failure(fn(this.error)) : Result.success(this._value as T);
  }

  getOrElse(defaultValue: T): T {
    return this.isSuccess() ? this.value : defaultValue;
  }

  onSuccess(fn: (value: T) => void): this {
    if (this.isSuccess()) fn(this.value);

    return this;
  }

  onFailure(fn: (error: E) => void): this {
    if (this.isFailure()) fn(this.error);

    return this;
  }

  match<U>(onSuccess: (value: T) => U, onFailure: (error: E) => U): U {
    return this.isSuccess() ? onSuccess(this.value) : onFailure(this.error);
  }
}
