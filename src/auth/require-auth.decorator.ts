import { AuthProvider } from "./auth-provider";
import { NotAuthenticated } from './exceptions';

export function RequireAuth(onFail?: () => any) {
  return function <
    A extends any[],
    R,
    T extends { authProvider?: AuthProvider<any> }
  >(
    originalMethod: (this: T, ...args: A) => Promise<R>,
    _context: ClassMethodDecoratorContext<any, typeof originalMethod>
  ): (this: T, ...args: A) => Promise<R> {
    return async function (this: T, ...args: A): Promise<R> {
      if (!this.authProvider) {
        throw new Error("authProvider: AuthProvider is required on this instance");
      }

      const isAuthenticated = await this.authProvider.isAuthenticated();

      if (!isAuthenticated) {
        if (onFail) {
          return onFail();
        } else {
          throw new NotAuthenticated();
        }
      }

      return await originalMethod.apply(this, args);
    };
  };
}
