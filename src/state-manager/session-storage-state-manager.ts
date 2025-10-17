import { StateManager } from './state-manager';

export class SessionStorageStateManager<Schema extends Record<string, any>> extends StateManager<Schema> {
  constructor(initialState: Schema) {
    super(initialState); 
    this.loadPersistedState();
  }

  private loadPersistedState(): void {
    const keys = Object.keys(this.state) as Array<keyof Schema>;

    for (const key of keys) {
      const storageKey = String(key); 
      const persistedValue = sessionStorage.getItem(storageKey);
      this.state[key] = JSON.parse(persistedValue || "null");
    }
  }

  private persistValue<Key extends keyof Schema>(key: Key, value: Schema[Key]): void {
    const storageKey = String(key); 

    sessionStorage.setItem(storageKey, JSON.stringify(value));
  }

  public async getValue<Key extends keyof Schema>(key: Key): Promise<Schema[Key]> {
    return this.state[key];
  }

  public async setValue<Key extends keyof Schema>(key: Key, value: Schema[Key]): Promise<void> {
    this.state = {
      ...this.state,
      [key]: value
    };

    this.persistValue(key, value);
    this.notifyListeners();
  }

  public async removeValue<Key extends keyof Schema>(key: Key): Promise<void> {
    const storageKey = String(key);
    const { [key]: _, ...newState } = this.state;
    this.state = newState as Schema;

    sessionStorage.removeItem(storageKey);
    this.notifyListeners();
  }
}
