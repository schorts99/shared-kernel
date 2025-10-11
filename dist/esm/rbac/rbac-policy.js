"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RBACPolicy = void 0;
class RBACPolicy {
    can(role, action, resource) {
        const permissions = this.getPermissions(role);
        return permissions.some((perm) => (perm.resource === '*' || perm.resource === resource.name) &&
            (perm.action === action || perm.action === 'manage'));
    }
    canAccessOwnedResource(resource) {
        return resource.owner_id === this.userID.value;
    }
    canWithOwnership(role, action, resource) {
        return this.can(role, action, resource) && this.canAccessOwnedResource(resource);
    }
}
exports.RBACPolicy = RBACPolicy;
//# sourceMappingURL=rbac-policy.js.map