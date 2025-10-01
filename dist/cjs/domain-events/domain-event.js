"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DomainEvent = void 0;
class DomainEvent {
    id;
    occurredAt;
    type;
    version;
    payload;
    constructor(id, occurredAt, type, version, payload) {
        this.id = id;
        this.occurredAt = occurredAt;
        this.type = type;
        this.version = version;
        this.payload = payload;
    }
}
exports.DomainEvent = DomainEvent;
//# sourceMappingURL=domain-event.js.map