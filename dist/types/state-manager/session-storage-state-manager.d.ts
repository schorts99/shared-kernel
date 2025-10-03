import { StateManager } from './state-manager';
export declare class SessionStorageStateManager<Schema extends Record<string, any>> extends StateManager<Schema> {
    constructor(initialState: Schema);
    private loadPersistedState;
    private persistValue;
    getValue<Key extends keyof Schema>(key: Key): Promise<Schema[Key]>;
    setValue<Key extends keyof Schema>(key: Key, value: Schema[Key]): Promise<void>;
    removeValue<Key extends keyof Schema>(key: Key): Promise<void>;
}
//# sourceMappingURL=session-storage-state-manager.d.ts.map