import { StateManager } from "../state-manager";

/**
 * Browser LocalStorage implementation of StateManager.
 */
export class LocalStorageStateManager<Schema extends Record<string, any>> extends StateManager<Schema> {
  constructor(initialState: Schema) {
    super(initialState);
    this.loadPersistedState();
  }

  public getValue<Key extends keyof Schema>(key: Key): Schema[Key] {
    return this.state[key];
  }

  public setValue<Key extends keyof Schema>(key: Key, value: Schema[Key]): void {
    this.state = {
      ...this.state,
      [key]: value,
    };

    this.persistValue(key, value);
    this.notifyListeners();
  }

  public removeValue<Key extends keyof Schema>(key: Key): void {
    const storageKey = String(key);
    const { [key]: _, ...newState } = this.state;
    this.state = newState as Schema;

    localStorage.removeItem(storageKey);
    this.notifyListeners();
  }

  public patch(values: Partial<Schema>): void {
    this.state = {
      ...this.state,
      ...values,
    };

    Object.entries(values).forEach(([key, value]) => {
      this.persistValue(key as keyof Schema, value as Schema[keyof Schema]);
    });

    this.notifyListeners();
  }

  public reset(): void {
    // Clear all current keys from storage
    Object.keys(this.state).forEach((key) => {
      localStorage.removeItem(String(key));
    });

    // Restore and persist initial state
    this.state = { ...this.initialState };
    Object.entries(this.state).forEach(([key, value]) => {
      this.persistValue(key as keyof Schema, value as Schema[keyof Schema]);
    });

    this.notifyListeners();
  }

  private loadPersistedState(): void {
    const keys = Object.keys(this.state) as Array<keyof Schema>;

    for (const key of keys) {
      const storageKey = String(key);
      const persistedValue = localStorage.getItem(storageKey);
      if (persistedValue !== null) {
        try {
          this.state[key] = JSON.parse(persistedValue);
        } catch (e) {
          console.error(`[LocalStorageStateManager] Error parsing key "${storageKey}":`, e);
        }
      }
    }
  }

  private persistValue<Key extends keyof Schema>(key: Key, value: Schema[Key]): void {
    const storageKey = String(key);
    localStorage.setItem(storageKey, JSON.stringify(value));
  }
}
