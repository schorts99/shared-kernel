import { DependencyNotRegistered } from "./exceptions";

export class DependencyRegistry {
  private static registry = new Map<string, () => any>();

  static registerSingleton<Type>(key: string, instance: Type): void {
    this.registry.set(key, () => instance);
  }

  static registerFactory<Type>(key: string, factory: () => Type): void {
    this.registry.set(key, factory);
  }

  static resolve<Type>(key: string): Type {
    const factory = this.registry.get(key);

    if (!factory) throw new DependencyNotRegistered(`key: ${key}`);

    return factory();
  }
}
