export class Result<Type> {
  private readonly success: boolean;
  private readonly value: Type | undefined;
  private readonly error: Error | undefined;

  private constructor(success: boolean, value?: Type, error?: Error) {
    this.success = success;
    this.value = value;
    this.error = error;
  }

  static success<Type>(value: Type): Result<Type> {
    return new Result<Type>(true, value);
  }

  static error<Type>(error: Error): Result<Type> {
    return new Result<Type>(false, undefined, error);
  }

  isSuccess(): boolean {
    return this.success;
  }
  
  isFailure(): boolean {
    return !this.isSuccess();
  }

  getValue(): Type | undefined {
    return this.value;
  }

  getError(): Error | undefined {
    return this.error;
  }
}
