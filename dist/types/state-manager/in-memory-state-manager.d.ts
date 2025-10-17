import { StateManager } from './state-manager';
export declare class InMemoryStateManager<Schema extends Record<string, any>> extends StateManager<Schema> {
    constructor(initialState?: Schema);
    getValue<Key extends keyof Schema>(key: Key): Promise<Schema[Key]>;
    setValue<Key extends keyof Schema>(key: Key, value: Schema[Key]): Promise<void>;
    removeValue<Key extends keyof Schema>(key: Key): Promise<void>;
}
//# sourceMappingURL=in-memory-state-manager.d.ts.map