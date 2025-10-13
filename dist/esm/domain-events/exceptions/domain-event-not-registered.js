"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DomainEventNotRegistered = void 0;
class DomainEventNotRegistered extends Error {
    constructor(domainEventName, translationResolver) {
        const message = translationResolver
            ? translationResolver.resolve("domain_events.errors.domain_event_not_registered")
            : `DomainEvent Not Registered: ${domainEventName}`;
        super(message);
    }
}
exports.DomainEventNotRegistered = DomainEventNotRegistered;
//# sourceMappingURL=domain-event-not-registered.js.map