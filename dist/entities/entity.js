"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Entity = void 0;
class Entity {
    id;
    domainEvents = [];
    constructor(id) {
        this.id = id;
    }
    pullDomainEvents() {
        const domainEvents = [...this.domainEvents];
        this.domainEvents = [];
        return domainEvents;
    }
    recordDomainEvent(domainEvent) {
        this.domainEvents.push(domainEvent);
    }
    static fromPrimitives(_model) {
        throw new Error("Method not implemented.");
    }
}
exports.Entity = Entity;
//# sourceMappingURL=entity.js.map