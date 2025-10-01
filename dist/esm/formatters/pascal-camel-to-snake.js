"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PascalCamelToSnake = void 0;
class PascalCamelToSnake {
    static format(text) {
        return text
            .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
            .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
            .toLowerCase();
    }
}
exports.PascalCamelToSnake = PascalCamelToSnake;
//# sourceMappingURL=pascal-camel-to-snake.js.map