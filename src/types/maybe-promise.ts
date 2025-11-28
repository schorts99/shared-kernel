export type MaybePromise<IsAsync extends boolean, T> = IsAsync extends true ? Promise<T> : T;
