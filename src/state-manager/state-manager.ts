import { MaybePromise } from "../types";

export abstract class StateManager<Schema extends Record<string, any>, IsAsync extends boolean = false> {
  protected state: Schema;
  private listeners: Array<(state: Schema) => void> = [];

  constructor(initialState: Schema = {} as Schema) {
    this.state = initialState;
  }

  abstract getValue<Key extends keyof Schema>(key: Key): MaybePromise<IsAsync, Schema[Key]>;
  abstract setValue<Key extends keyof Schema>(key: Key, value: Schema[Key]): MaybePromise<IsAsync, void>;
  abstract removeValue<Key extends keyof Schema>(key: Key): MaybePromise<IsAsync, void>;

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
