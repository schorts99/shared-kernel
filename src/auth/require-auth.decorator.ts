import { AuthProvider } from "./auth-provider";
import { NotAuthenticated } from './exceptions';

export function RequireAuth(onFail?: () => any) {
  function wrapper<T extends { authProvider?: AuthProvider<any> }, A extends any[], R>(
    originalMethod: (this: T, ...args: A) => Promise<R>
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
  }

  return function (...args: any[]) {
    if (args.length === 3 && typeof args[2] === 'object') {
      const descriptor = args[2] as PropertyDescriptor;
      descriptor.value = wrapper(descriptor.value);
      return descriptor;
    }

    if (args.length === 2 && typeof args[1] === 'object' && 'kind' in args[1]) {
      const [originalMethod] = args;
      return wrapper(originalMethod);
    }

    throw new Error("RequireAuth decorator used incorrectly");
  };
}
