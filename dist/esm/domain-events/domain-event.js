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
    toPrimitives() {
        return {
            id: this.id,
            occurred_at: this.occurredAt.toString(),
            type: this.type,
            version: this.version,
            payload: this.payload,
            meta: this.meta,
        };
    }
    ack;
    requeue;
}
exports.DomainEvent = DomainEvent;
//# sourceMappingURL=domain-event.js.map