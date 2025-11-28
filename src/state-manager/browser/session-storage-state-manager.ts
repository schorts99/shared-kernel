import { StateManager } from "../state-manager";

export class SessionStorageStateManager<Schema extends Record<string, any>> extends StateManager<Schema> {
  constructor(initialState: Schema) {
    super(initialState); 
    this.loadPersistedState();
  }

  public getValue<Key extends keyof Schema>(key: Key) {
    return this.state[key];
  }

  public setValue<Key extends keyof Schema>(key: Key, value: Schema[Key]) {
    this.state = {
      ...this.state,
      [key]: value
    };

    this.persistValue(key, value);
    this.notifyListeners();
  }

  public removeValue<Key extends keyof Schema>(key: Key) {
    const storageKey = String(key);
    const { [key]: _, ...newState } = this.state;
    this.state = newState as Schema;

    sessionStorage.removeItem(storageKey);
    this.notifyListeners();
  }

  private loadPersistedState(): void {
    const keys = Object.keys(this.state) as Array<keyof Schema>;

    for (const key of keys) {
      const storageKey = String(key); 
      const persistedValue = sessionStorage.getItem(storageKey);
      this.state[key] = JSON.parse(persistedValue || "null");
    }
  }

  private persistValue<Key extends keyof Schema>(key: Key, value: Schema[Key]) {
    const storageKey = String(key); 

    sessionStorage.setItem(storageKey, JSON.stringify(value));
  }
}
