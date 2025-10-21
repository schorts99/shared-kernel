import { Permission } from './permission';
import { BaseResource } from './base-resource';
import { Predicate } from '../abac';
export declare abstract class RBACPolicy {
    abstract getPermissions(role: string): Permission[];
    can(role: string, action: Permission['action'], resource: BaseResource): boolean;
    canWithAttributes<User extends {
        id: string;
    }, Resource extends BaseResource>(user: User, role: string, action: Permission['action'], resource: Resource, predicates: Predicate<User, Resource>[]): boolean;
    canAnyWithAttributes<User extends {
        id: string;
    }, Resource extends BaseResource>(user: User, role: string, action: Permission['action'], resource: Resource, predicates: Predicate<User, Resource>[]): boolean;
}
//# sourceMappingURL=rbac-policy.d.ts.map