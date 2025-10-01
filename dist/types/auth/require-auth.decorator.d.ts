import { AuthProvider } from "./auth-provider";
export declare function RequireAuth(onFail?: () => any): (...args: any[]) => PropertyDescriptor | ((this: {
    authProvider?: AuthProvider<any>;
}, ...args: any[]) => Promise<unknown>);
//# sourceMappingURL=require-auth.decorator.d.ts.map