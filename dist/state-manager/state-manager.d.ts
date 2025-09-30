export declare abstract class StateManager<Schema extends Record<string, any>> {
    protected state: Schema;
    private listeners;
    constructor(initialState?: Schema);
    abstract getValue<Key extends keyof Schema>(key: Key): Promise<Schema[Key]>;
    abstract setValue<Key extends keyof Schema>(key: Key, value: Schema[Key]): Promise<void>;
    abstract removeValue<Key extends keyof Schema>(key: Key): Promise<void>;
    getState(): Schema;
    subscribe(listener: (state: Schema) => void): () => void;
    protected notifyListeners(): void;
}
//# sourceMappingURL=state-manager.d.ts.map