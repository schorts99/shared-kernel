export declare class Result<Type> {
    private readonly success;
    private readonly value;
    private readonly error;
    private constructor();
    static success<Type>(value: Type): Result<Type>;
    static error<Type>(error: Error): Result<Type>;
    isSuccess(): boolean;
    isFailure(): boolean;
    getValue(): Type | undefined;
    getError(): Error | undefined;
}
//# sourceMappingURL=result.d.ts.map