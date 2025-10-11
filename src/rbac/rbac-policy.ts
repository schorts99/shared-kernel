import { Permission } from './permission';
import { Resource } from './resource';
import { ValueObject } from '../value-objects';

export abstract class RBACPolicy<Role extends string, UserID extends ValueObject> {
  abstract userID: UserID;
  abstract getPermissions(role: Role): Permission[];

  can(role: Role, action: Permission['action'], resource: Resource): boolean {
    const permissions = this.getPermissions(role);

    return permissions.some(
      (perm) =>
        (perm.resource === '*' || perm.resource === resource.name) &&
        (perm.action === action || perm.action === 'manage')
    );
  }

  canAccessOwnedResource(resource: Resource): boolean {
    return resource.owner_id === this.userID.value;
  }

  canWithOwnership(role: Role, action: Permission['action'], resource: Resource): boolean {
    return this.can(role, action, resource) && this.canAccessOwnedResource(resource);
  }
}
