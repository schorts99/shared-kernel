import { Permission, BaseAction } from './permission';
import { BaseResource } from './base-resource';
import { Predicate } from '../abac';

export abstract class RBACPolicy<Action extends string = BaseAction> {
  abstract getPermissions(role: string): Permission<Action>[];

  can(roles: string | string[], action: Action | BaseAction, resource: string | BaseResource): boolean {
    const roleList = Array.isArray(roles) ? roles : [roles];
    const resourceName = typeof resource === 'string' ? resource : resource.name;

    return roleList.some((role) => {
      const permissions = this.getPermissions(role);

      return permissions.some(
        (perm) =>
          (perm.resource === '*' || perm.resource === resourceName) &&
          (perm.action === '*' || perm.action === 'manage' || perm.action === action)
      );
    });
  }

  canWithAttributes<User extends { id: string }, Resource extends BaseResource>(
    user: User,
    roles: string | string[],
    action: Action | BaseAction,
    resource: Resource,
    predicates: Predicate<User, Resource>[],
  ): boolean {
    if (!this.can(roles, action, resource)) return false;

    return predicates.every((predicate) => predicate(user, resource));
  }

  canAnyWithAttributes<User extends { id: string }, Resource extends BaseResource>(
    user: User,
    roles: string | string[],
    action: Action | BaseAction,
    resource: Resource,
    predicates: Predicate<User, Resource>[]
  ): boolean {
    if (!this.can(roles, action, resource)) return false;

    return predicates.some((predicate) => predicate(user, resource));
  }
}

export class StaticRBACPolicy<Action extends string = BaseAction> extends RBACPolicy<Action> {
  constructor(private readonly roles: Record<string, Permission<Action>[]>) {
    super();
  }

  getPermissions(role: string): Permission<Action>[] {
    return this.roles[role] ?? [];
  }
}
