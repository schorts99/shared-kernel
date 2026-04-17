import { StateManager } from "../state-manager";

export class InMemoryStateManager<Schema extends Record<string, any>> extends StateManager<Schema> {
  constructor(initialState: Schema = {} as Schema) {
    super(initialState);
  }

  getValue<Key extends keyof Schema>(key: Key): Schema[Key] {
    return this.state[key];
  }

  setValue<Key extends keyof Schema>(key: Key, value: Schema[Key]): void {
    this.state = {
      ...this.state,
      [key]: value,
    };

    this.notifyListeners();
  }

  removeValue<Key extends keyof Schema>(key: Key): void {
    const { [key]: _, ...newState } = this.state;
    this.state = newState as Schema;

    this.notifyListeners();
  }

  patch(values: Partial<Schema>): void {
    this.state = {
      ...this.state,
      ...values,
    };

    this.notifyListeners();
  }

  reset(): void {
    this.state = { ...this.initialState };

    this.notifyListeners();
  }
}
