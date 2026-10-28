import { MaybePromise } from "../types/index.js";
import { cloneValue, deepEqual } from "../utils/object.js";

export abstract class StateManager<Schema extends Record<string, any>, IsAsync extends boolean = false> {
  protected state: Schema;
  protected readonly initialState: Schema;
  private listeners: Array<(state: Schema) => void> = [];

  constructor(initialState: Schema = {} as Schema) {
    this.initialState = cloneValue(initialState);
    this.state = cloneValue(initialState);
  }

  abstract getValue<Key extends keyof Schema>(key: Key): MaybePromise<IsAsync, Schema[Key]>;

  abstract setValue<Key extends keyof Schema>(key: Key, value: Schema[Key]): MaybePromise<IsAsync, void>;

  abstract removeValue<Key extends keyof Schema>(key: Key): MaybePromise<IsAsync, void>;

  abstract patch(values: Partial<Schema>): MaybePromise<IsAsync, void>;

  abstract reset(): MaybePromise<IsAsync, void>;

  getState(): Schema {
    return cloneValue(this.state);
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
    let lastValue = cloneValue(this.state[key]);

    return this.subscribe((state) => {
      const currentValue = state[key];

      if (!deepEqual(currentValue, lastValue)) {
        lastValue = cloneValue(currentValue);
        listener(cloneValue(currentValue));
      }
    });
  }

  protected notifyListeners(): void {
    for (const listener of [...this.listeners]) {
      listener(this.getState());
    }
  }
}
