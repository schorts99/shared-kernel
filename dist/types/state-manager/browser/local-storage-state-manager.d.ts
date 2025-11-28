import { StateManager } from "../state-manager";
export declare class LocalStorageStateManager<Schema extends Record<string, any>> extends StateManager<Schema> {
    constructor(initialState: Schema);
    getValue<Key extends keyof Schema>(key: Key): Schema[Key];
    setValue<Key extends keyof Schema>(key: Key, value: Schema[Key]): void;
    removeValue<Key extends keyof Schema>(key: Key): void;
    private loadPersistedState;
    private persistValue;
}
//# sourceMappingURL=local-storage-state-manager.d.ts.map