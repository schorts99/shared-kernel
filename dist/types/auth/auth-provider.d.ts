import { Entity } from "../entities";
import { Model } from "../models";
import { ValueObject } from "../value-objects";
import { MaybePromise } from "../types";
export interface AuthProvider<UserEntity extends Entity<ValueObject, Model>, IsAsync extends boolean = false> {
    authenticate(...args: any[]): MaybePromise<IsAsync, string>;
    logout(): MaybePromise<IsAsync, void>;
    isAuthenticated(): MaybePromise<IsAsync, boolean>;
    getCurrentUser(): MaybePromise<IsAsync, UserEntity | null>;
    onAuthChange(callback: (user: UserEntity | null) => void): () => void;
}
//# sourceMappingURL=auth-provider.d.ts.map