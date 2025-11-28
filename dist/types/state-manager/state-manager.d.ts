import { MaybePromise } from "../types";
export declare abstract class StateManager<Schema extends Record<string, any>, IsAsync extends boolean = false> {
    protected state: Schema;
    private listeners;
    constructor(initialState?: Schema);
    abstract getValue<Key extends keyof Schema>(key: Key): MaybePromise<IsAsync, Schema[Key]>;
    abstract setValue<Key extends keyof Schema>(key: Key, value: Schema[Key]): MaybePromise<IsAsync, void>;
    abstract removeValue<Key extends keyof Schema>(key: Key): MaybePromise<IsAsync, void>;
    getState(): Schema;
    subscribe(listener: (state: Schema) => void): () => void;
    protected notifyListeners(): void;
}
//# sourceMappingURL=state-manager.d.ts.map