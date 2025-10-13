"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DomainEvent = void 0;
class DomainEvent {
    id;
    occurredAt;
    type;
    version;
    payload;
    meta;
    constructor(id, occurredAt, type, version, payload, meta = { retries: 0 }) {
        this.id = id;
        this.occurredAt = occurredAt;
        this.type = type;
        this.version = version;
        this.payload = payload;
        this.meta = meta;
    }
    ack;
    requeue;
}
exports.DomainEvent = DomainEvent;
//# sourceMappingURL=domain-event.js.map