import { DeadLetterStore } from "../dead-letter-store";
import { DomainEventPrimitives } from "../../domain-events";
export declare class InMemoryDeadLetterStore implements DeadLetterStore {
    private readonly failed;
    add(primitives: DomainEventPrimitives, reason: string): void;
    all(): Array<{
        primitives: DomainEventPrimitives;
        reason: string;
    }>;
    clear(): void;
}
//# sourceMappingURL=in-memory-dead-letter-store.d.ts.map