"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RequireAuth = RequireAuth;
const exceptions_1 = require("./exceptions");
function RequireAuth(onFail) {
    function wrapper(originalMethod) {
        return async function (...args) {
            if (!this.authProvider) {
                throw new Error("authProvider: AuthProvider is required on this instance");
            }
            const isAuthenticated = await this.authProvider.isAuthenticated();
            if (!isAuthenticated) {
                if (onFail) {
                    return onFail();
                }
                else {
                    throw new exceptions_1.NotAuthenticated(this.translationResolver);
                }
            }
            return await originalMethod.apply(this, args);
        };
    }
    return function (...args) {
        if (args.length === 3 && typeof args[2] === 'object') {
            const descriptor = args[2];
            descriptor.value = wrapper(descriptor.value);
            return descriptor;
        }
        if (args.length === 2 && typeof args[1] === 'object' && 'kind' in args[1]) {
            const [originalMethod] = args;
            return wrapper(originalMethod);
        }
        throw new exceptions_1.RequireAuthNotImplementedCorrectly();
    };
}
//# sourceMappingURL=require-auth.decorator.js.map