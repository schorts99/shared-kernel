import { DomainEventPrimitives } from "../domain-events";
import { MaybePromise } from "../types";
export interface DeadLetterStore<IsAsync extends boolean = false> {
    add(primitives: DomainEventPrimitives, reason: string): MaybePromise<IsAsync, void>;
    all(): MaybePromise<IsAsync, Array<{
        primitives: DomainEventPrimitives;
        reason: string;
    }>>;
    clear(): MaybePromise<IsAsync, void>;
}
//# sourceMappingURL=dead-letter-store.d.ts.map