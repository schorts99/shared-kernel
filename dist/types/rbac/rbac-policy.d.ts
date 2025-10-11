import { Permission } from './permission';
import { Resource } from './resource';
import { ValueObject } from '../value-objects';
export declare abstract class RBACPolicy<Role extends string, UserID extends ValueObject> {
    abstract userID: UserID;
    abstract getPermissions(role: Role): Permission[];
    can(role: Role, action: Permission['action'], resource: Resource): boolean;
    canAccessOwnedResource(resource: Resource): boolean;
    canWithOwnership(role: Role, action: Permission['action'], resource: Resource): boolean;
}
//# sourceMappingURL=rbac-policy.d.ts.map