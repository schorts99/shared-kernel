import { DomainEventPrimitives } from "../domain-events";
export interface DeadLetterStore {
    add(primitives: DomainEventPrimitives, reason: string): void;
    all(): Array<{
        primitives: DomainEventPrimitives;
        reason: string;
    }>;
    clear(): void;
}
//# sourceMappingURL=dead-letter-store.d.ts.map