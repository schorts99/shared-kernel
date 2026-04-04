import { Permission, BaseAction } from './permission';
import { BaseResource } from './base-resource';
import { Predicate } from '../abac';

export abstract class RBACPolicy<Action extends string = BaseAction> {
  abstract getPermissions(role: string): Permission[];

  can(role: string, action: Action, resource: BaseResource): boolean {
    const permissions = this.getPermissions(role);

    return permissions.some(
      (perm) =>
        (perm.resource === '*' || perm.resource === resource.name) &&
        (perm.action === action || perm.action === 'manage')
    );
  }

  canWithAttributes<User extends  { id: string }, Resource extends BaseResource>(
    user: User,
    role: string,
    action: Action,
    resource: Resource,
    predicates: Predicate<User, Resource>[],
  ): boolean {
    if (!this.can(role, action, resource)) return false;

    return predicates.every((predicate) => predicate(user, resource));
  }

  canAnyWithAttributes<User extends { id: string }, Resource extends BaseResource>(
    user: User,
    role: string,
    action: Action,
    resource: Resource,
    predicates: Predicate<User, Resource>[]
  ): boolean {
    if (!this.can(role, action, resource)) return false;

    return predicates.some((predicate) => predicate(user, resource));
  }
}
