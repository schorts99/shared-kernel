"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RequireAuthNotImplementedCorrectly = void 0;
class RequireAuthNotImplementedCorrectly extends Error {
    constructor(translationResolver) {
        const message = translationResolver
            ? translationResolver.resolve("auth.errors.require_auth_not_implemented_correctly")
            : "RequireAuth decorator not implemented correctly";
        super(message);
    }
}
exports.RequireAuthNotImplementedCorrectly = RequireAuthNotImplementedCorrectly;
//# sourceMappingURL=require-auth-not-implemented-correctly.js.map