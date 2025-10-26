export declare class DependencyRegistry {
    private static registry;
    static registerSingleton<Type>(key: string, instance: Type): void;
    static registerFactory<Type>(key: string, factory: () => Type): void;
    static resolve<Type>(key: string): Type;
}
//# sourceMappingURL=dependency-registry.d.ts.map