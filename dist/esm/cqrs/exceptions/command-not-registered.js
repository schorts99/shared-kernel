"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommandNotRegistered = void 0;
class CommandNotRegistered extends Error {
    constructor(command, translationResolver) {
        const message = translationResolver
            ? translationResolver.resolve("cqrs.errors.command_not_registered")
            : `Command Not Registered: ${command}`;
        super(message);
    }
}
exports.CommandNotRegistered = CommandNotRegistered;
//# sourceMappingURL=command-not-registered.js.map