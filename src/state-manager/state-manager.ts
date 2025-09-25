export abstract class StateManager<Schema extends Record<string, any>> {
  protected state: Schema;
  private listeners: Array<(state: Schema) => void> = [];

  constructor(initialState: Schema = {} as Schema) {
    this.state = initialState;
  }

  abstract getValue<Key extends keyof Schema>(key: Key): Promise<Schema[Key]>;
  abstract setValue<Key extends keyof Schema>(key: Key, value: Schema[Key]): Promise<void>;
  abstract removeValue<Key extends keyof Schema>(key: Key): Promise<void>;

  getState(): Schema {
    return this.state;
  }

  subscribe(listener: (state: Schema) => void): () => void {
    this.listeners.push(listener);

    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  protected notifyListeners(): void {
    this.listeners.forEach(listener => listener(this.state));
  }
}
