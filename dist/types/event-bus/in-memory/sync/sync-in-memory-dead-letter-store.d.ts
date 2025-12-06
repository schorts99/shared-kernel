import { DeadLetterStore } from "../../dead-letter-store";
import { DomainEventPrimitives } from "../../../domain-events";
export declare class SyncInMemoryDeadLetterStore implements DeadLetterStore {
    private readonly failed;
    add(primitives: DomainEventPrimitives, reason: string): void;
    all(): {
        primitives: DomainEventPrimitives;
        reason: string;
    }[];
    clear(): void;
}
//# sourceMappingURL=sync-in-memory-dead-letter-store.d.ts.map