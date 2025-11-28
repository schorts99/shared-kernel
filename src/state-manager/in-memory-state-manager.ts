import { StateManager } from "./state-manager";

export class InMemoryStateManager<Schema extends Record<string, any>> extends StateManager<Schema> {
  constructor(initialState: Schema = {} as Schema) {
    super(initialState);
  }

  getValue<Key extends keyof Schema>(key: Key){
    return this.state[key];
  }

  setValue<Key extends keyof Schema>(key: Key, value: Schema[Key]) {
    this.state[key] = value;

    this.notifyListeners();
  }

  removeValue<Key extends keyof Schema>(key: Key) {
    delete this.state[key];
    this.notifyListeners();
  }
}
