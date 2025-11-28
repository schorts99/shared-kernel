import { MaybePromise } from "../types";
export interface Publisher<IsAsync extends boolean = false> {
    publish(channel: string, event: string, payload: any): MaybePromise<IsAsync, void>;
}
//# sourceMappingURL=publisher.d.ts.map