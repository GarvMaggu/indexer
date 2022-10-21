"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InvalidRequestError = exports.RequestWasThrottledError = void 0;
class RequestWasThrottledError extends Error {
    constructor(message, delay) {
        super(message);
        this.delay = 0;
        this.delay = delay;
        Object.setPrototypeOf(this, RequestWasThrottledError.prototype);
    }
}
exports.RequestWasThrottledError = RequestWasThrottledError;
class InvalidRequestError extends Error {
    constructor(message) {
        super(message);
        Object.setPrototypeOf(this, InvalidRequestError.prototype);
    }
}
exports.InvalidRequestError = InvalidRequestError;
//# sourceMappingURL=errors.js.map