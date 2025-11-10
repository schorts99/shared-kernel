import { DeadLetterStore } from "../dead-letter-store";
import { DomainEventPrimitives } from "../../domain-events";
export declare class AsyncInMemoryDeadLetterStore implements DeadLetterStore {
    private readonly failed;
    add(primitives: DomainEventPrimitives, reason: string): Promise<void>;
    all(): Promise<Array<{
        primitives: DomainEventPrimitives;
        reason: string;
    }>>;
    clear(): Promise<void>;
}
//# sourceMappingURL=async-in-memory-dead-letter-store.d.ts.map