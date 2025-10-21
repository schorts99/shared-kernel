"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RBACPolicy = void 0;
class RBACPolicy {
    can(role, action, resource) {
        const permissions = this.getPermissions(role);
        return permissions.some((perm) => (perm.resource === '*' || perm.resource === resource.name) &&
            (perm.action === action || perm.action === 'manage'));
    }
    canWithAttributes(user, role, action, resource, predicates) {
        if (!this.can(role, action, resource))
            return false;
        return predicates.every((predicate) => predicate(user, resource));
    }
    canAnyWithAttributes(user, role, action, resource, predicates) {
        if (!this.can(role, action, resource))
            return false;
        return predicates.some((predicate) => predicate(user, resource));
    }
}
exports.RBACPolicy = RBACPolicy;
//# sourceMappingURL=rbac-policy.js.map