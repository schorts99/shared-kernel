import { Entity } from "../entities";
import { BaseModel } from "../models";
import { ValueObject } from "../value-objects";
export interface AuthProvider<UserEntity extends Entity<ValueObject, BaseModel>> {
    authenticate(...args: any[]): Promise<string>;
    logout(): Promise<void>;
    isAuthenticated(): Promise<boolean>;
    getCurrentUser(): Promise<UserEntity | null>;
    onAuthChange(callback: (user: UserEntity | null) => void): () => void;
}
//# sourceMappingURL=auth-provider.d.ts.map