"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotAuthenticated = void 0;
class NotAuthenticated extends Error {
    constructor(translationResolver) {
        const message = translationResolver
            ? translationResolver.resolve("auth.errors.not_authenticated")
            : "Not Authenticated";
        super(message);
    }
}
exports.NotAuthenticated = NotAuthenticated;
//# sourceMappingURL=not-authenticated.js.map