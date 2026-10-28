import { StateManager } from "../state-manager";
import { cloneValue } from "../../utils/object";

export class InMemoryStateManager<Schema extends Record<string, any>> extends StateManager<Schema> {
  constructor(initialState: Schema = {} as Schema) {
    super(initialState);
  }

  getValue<Key extends keyof Schema>(key: Key): Schema[Key] {
    return cloneValue(this.state[key]);
  }

  setValue<Key extends keyof Schema>(key: Key, value: Schema[Key]): void {
    this.state = {
      ...this.state,
      [key]: cloneValue(value),
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
      ...cloneValue(values),
    };

    this.notifyListeners();
  }

  reset(): void {
    this.state = cloneValue(this.initialState);

    this.notifyListeners();
  }
}
