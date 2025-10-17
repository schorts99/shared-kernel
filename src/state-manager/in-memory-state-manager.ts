import { StateManager } from './state-manager';

export class InMemoryStateManager<Schema extends Record<string, any>> extends StateManager<Schema> {
  constructor(initialState: Schema = {} as Schema) {
    super(initialState);
  }

  async getValue<Key extends keyof Schema>(key: Key): Promise<Schema[Key]> {
    return this.state[key];
  }

  async setValue<Key extends keyof Schema>(key: Key, value: Schema[Key]): Promise<void> {
    this.state[key] = value;

    this.notifyListeners();
  }

  async removeValue<Key extends keyof Schema>(key: Key): Promise<void> {
    delete this.state[key];
    this.notifyListeners();
  }
}
