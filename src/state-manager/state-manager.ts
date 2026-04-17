import { MaybePromise } from "../types";

export abstract class StateManager<Schema extends Record<string, any>, IsAsync extends boolean = false> {
  protected state: Schema;
  protected readonly initialState: Schema;
  private listeners: Array<(state: Schema) => void> = [];

  constructor(initialState: Schema = {} as Schema) {
    this.initialState = { ...initialState };
    this.state = { ...initialState };
  }

  abstract getValue<Key extends keyof Schema>(key: Key): MaybePromise<IsAsync, Schema[Key]>;

  abstract setValue<Key extends keyof Schema>(key: Key, value: Schema[Key]): MaybePromise<IsAsync, void>;

  abstract removeValue<Key extends keyof Schema>(key: Key): MaybePromise<IsAsync, void>;

  abstract patch(values: Partial<Schema>): MaybePromise<IsAsync, void>;

  abstract reset(): MaybePromise<IsAsync, void>;

  getState(): Schema {
    return { ...this.state };
  }

  subscribe(listener: (state: Schema) => void): () => void {
    this.listeners.push(listener);

    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  subscribeToKey<Key extends keyof Schema>(
    key: Key,
    listener: (value: Schema[Key]) => void
  ): () => void {
    let lastValue = this.state[key];

    return this.subscribe((state) => {
      const currentValue = state[key];

      if (currentValue !== lastValue) {
        lastValue = currentValue;
        listener(currentValue);
      }
    });
  }

  protected notifyListeners(): void {
    const currentState = this.getState();

    this.listeners.forEach(listener => listener(currentState));
  }
}
