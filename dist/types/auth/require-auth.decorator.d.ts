import { AuthProvider } from "./auth-provider";
import { TranslationResolver } from "../i18n";
export declare function RequireAuth(onFail?: () => any): (...args: any[]) => PropertyDescriptor | ((this: {
    authProvider?: AuthProvider<any>;
    translationResolver?: TranslationResolver;
}, ...args: any[]) => Promise<unknown>);
//# sourceMappingURL=require-auth.decorator.d.ts.map