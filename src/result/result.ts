export type ResultPrimitives<T = unknown, E = unknown> =
  | { isSuccess: true; value: T; error?: undefined }
  | { isSuccess: false; value?: undefined; error: E };

export interface ResultFromPrimitivesOptions<T, E> {
  hydrateValue?: (raw: any) => T;
  hydrateError?: (raw: any) => E;
}

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

  static async fromPromise<T, E = Error>(
    promiseOrFactory: Promise<T> | (() => Promise<T>),
    mapError?: (error: unknown) => E,
  ): Promise<Result<T, E>> {
    try {
      const promise =
        typeof promiseOrFactory === "function" ? promiseOrFactory() : promiseOrFactory;
      const value = await promise;
      return Result.success<T, E>(value);
    } catch (error) {
      if (mapError) {
        return Result.failure<T, E>(mapError(error));
      }
      const normalizedError =
        error instanceof Error ? error : new Error(`Promise rejected: ${String(error)}`);
      return Result.failure<T, E>(normalizedError as unknown as E);
    }
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
      throw this._error instanceof Error
        ? this._error
        : new Error(`Result failure: ${String(this._error)}`);
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

  async mapAsync<U>(fn: (value: T) => Promise<U> | U): Promise<Result<U, E>> {
    if (this.isFailure()) {
      return Result.failure(this.error);
    }
    const mapped = await fn(this.value);
    return Result.success(mapped);
  }

  flatMap<U>(fn: (value: T) => Result<U, E>): Result<U, E> {
    return this.isSuccess() ? fn(this.value) : Result.failure(this.error);
  }

  async flatMapAsync<U>(
    fn: (value: T) => Promise<Result<U, E>> | Result<U, E>,
  ): Promise<Result<U, E>> {
    if (this.isFailure()) {
      return Result.failure(this.error);
    }
    return await fn(this.value);
  }

  mapError<F>(fn: (error: E) => F): Result<T, F> {
    return this.isFailure() ? Result.failure(fn(this.error)) : Result.success(this._value as T);
  }

  async mapErrorAsync<F>(fn: (error: E) => Promise<F> | F): Promise<Result<T, F>> {
    if (this.isSuccess()) {
      return Result.success(this._value as T);
    }
    const mappedError = await fn(this.error);
    return Result.failure(mappedError);
  }

  getOrElse(defaultValue: T): T {
    return this.isSuccess() ? this.value : defaultValue;
  }

  onSuccess(fn: (value: T) => void): this {
    if (this.isSuccess()) fn(this.value);

    return this;
  }

  async onSuccessAsync(fn: (value: T) => Promise<void> | void): Promise<this> {
    if (this.isSuccess()) {
      await fn(this.value);
    }
    return this;
  }

  onFailure(fn: (error: E) => void): this {
    if (this.isFailure()) fn(this.error);

    return this;
  }

  async onFailureAsync(fn: (error: E) => Promise<void> | void): Promise<this> {
    if (this.isFailure()) {
      await fn(this.error);
    }
    return this;
  }

  match<U>(onSuccess: (value: T) => U, onFailure: (error: E) => U): U {
    return this.isSuccess() ? onSuccess(this.value) : onFailure(this.error);
  }

  async matchAsync<U>(
    onSuccess: (value: T) => Promise<U> | U,
    onFailure: (error: E) => Promise<U> | U,
  ): Promise<U> {
    return this.isSuccess() ? await onSuccess(this.value) : await onFailure(this.error);
  }

  toPrimitives(): ResultPrimitives<any, any> {
    if (this.isSuccess()) {
      const rawValue = this._value as any;
      const serializedValue =
        rawValue !== null &&
        rawValue !== undefined &&
        typeof rawValue.toPrimitives === "function"
          ? rawValue.toPrimitives()
          : rawValue;
      return {
        isSuccess: true,
        value: serializedValue,
      };
    }

    const rawError = this._error as any;
    let serializedError: any;
    if (rawError !== null && rawError !== undefined && typeof rawError.toPrimitives === "function") {
      serializedError = rawError.toPrimitives();
    } else if (rawError instanceof Error) {
      serializedError = {
        name: rawError.name,
        message: rawError.message,
        ...("code" in rawError ? { code: (rawError as any).code } : {}),
      };
    } else {
      serializedError = rawError;
    }

    return {
      isSuccess: false,
      error: serializedError,
    };
  }

  static fromPrimitives<T, E = Error>(
    primitives: ResultPrimitives<any, any>,
    options?: ResultFromPrimitivesOptions<T, E>,
  ): Result<T, E> {
    if (primitives.isSuccess) {
      const value = options?.hydrateValue
        ? options.hydrateValue(primitives.value)
        : (primitives.value as T);
      return Result.success<T, E>(value);
    }

    if (options?.hydrateError) {
      return Result.failure<T, E>(options.hydrateError(primitives.error));
    }

    const rawError = primitives.error;
    if (
      rawError &&
      typeof rawError === "object" &&
      !(rawError instanceof Error) &&
      typeof rawError.message === "string"
    ) {
      const reconstructed = new Error(rawError.message);
      if (typeof rawError.name === "string") {
        reconstructed.name = rawError.name;
      }
      if ("code" in rawError) {
        (reconstructed as any).code = rawError.code;
      }
      return Result.failure<T, E>(reconstructed as unknown as E);
    }

    return Result.failure<T, E>(rawError as E);
  }
}
