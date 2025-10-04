"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Result = void 0;
class Result {
    success;
    value;
    error;
    constructor(success, value, error) {
        this.success = success;
        this.value = value;
        this.error = error;
    }
    static success(value) {
        return new Result(true, value);
    }
    static error(error) {
        return new Result(false, undefined, error);
    }
    isSuccess() {
        return this.success;
    }
    isFailure() {
        return !this.isSuccess();
    }
    getValue() {
        return this.value;
    }
    getError() {
        return this.error;
    }
}
exports.Result = Result;
//# sourceMappingURL=result.js.map