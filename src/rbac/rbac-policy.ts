import { Permission, BaseAction } from "./permission.js";
import { BaseResource } from "./base-resource.js";
import {
  Predicate,
  AsyncPredicate,
  ContextualPredicate,
  AsyncContextualPredicate,
} from "../abac/index.js";

export abstract class RBACPolicy<Action extends string = BaseAction> {
  abstract getPermissions(role: string): Permission<Action>[];

  can(roles: string | string[], action: Action | BaseAction, resource: string | BaseResource): boolean {
    const roleList = Array.isArray(roles) ? roles : [roles];
    const resourceName = typeof resource === "string" ? resource : resource.name;

    return roleList.some((role) => {
      const permissions = this.getPermissions(role);

      return permissions.some(
        (perm) =>
          (perm.resource === "*" || perm.resource === resourceName) &&
          (perm.action === "*" || perm.action === "manage" || perm.action === action)
      );
    });
  }

  canWithAttributes<
    User extends { id: unknown },
    Resource extends BaseResource,
    Context = {},
  >(
    user: User,
    roles: string | string[],
    action: Action | BaseAction,
    resource: Resource,
    predicates: Array<Predicate<User, Resource> | ContextualPredicate<User, Resource, Context>>,
    context?: Context,
  ): boolean {
    if (!this.can(roles, action, resource)) return false;

    return predicates.every((predicate) => predicate(user, resource, context));
  }

  canAnyWithAttributes<
    User extends { id: unknown },
    Resource extends BaseResource,
    Context = {},
  >(
    user: User,
    roles: string | string[],
    action: Action | BaseAction,
    resource: Resource,
    predicates: Array<Predicate<User, Resource> | ContextualPredicate<User, Resource, Context>>,
    context?: Context,
  ): boolean {
    if (!this.can(roles, action, resource)) return false;
    if (predicates.length === 0) return true;

    return predicates.some((predicate) => predicate(user, resource, context));
  }

  async canWithAttributesAsync<
    User extends { id: unknown },
    Resource extends BaseResource,
    Context = {},
  >(
    user: User,
    roles: string | string[],
    action: Action | BaseAction,
    resource: Resource,
    predicates: Array<
      | Predicate<User, Resource>
      | AsyncPredicate<User, Resource>
      | ContextualPredicate<User, Resource, Context>
      | AsyncContextualPredicate<User, Resource, Context>
    >,
    context?: Context,
  ): Promise<boolean> {
    if (!this.can(roles, action, resource)) return false;

    for (const predicate of predicates) {
      const allowed = await predicate(user, resource, context);
      if (!allowed) return false;
    }

    return true;
  }

  async canAnyWithAttributesAsync<
    User extends { id: unknown },
    Resource extends BaseResource,
    Context = {},
  >(
    user: User,
    roles: string | string[],
    action: Action | BaseAction,
    resource: Resource,
    predicates: Array<
      | Predicate<User, Resource>
      | AsyncPredicate<User, Resource>
      | ContextualPredicate<User, Resource, Context>
      | AsyncContextualPredicate<User, Resource, Context>
    >,
    context?: Context,
  ): Promise<boolean> {
    if (!this.can(roles, action, resource)) return false;
    if (predicates.length === 0) return true;

    for (const predicate of predicates) {
      const allowed = await predicate(user, resource, context);
      if (allowed) return true;
    }

    return false;
  }
}

export class StaticRBACPolicy<Action extends string = BaseAction> extends RBACPolicy<Action> {
  private readonly roles: Record<string, Permission<Action>[]>;

  constructor(roles: Record<string, Permission<Action>[]>) {
    super();
    this.roles = Object.fromEntries(
      Object.entries(roles).map(([role, perms]) => [
        role,
        perms.map((perm) => ({ ...perm })),
      ]),
    );
  }

  getPermissions(role: string): Permission<Action>[] {
    return (this.roles[role] ?? []).map((perm) => ({ ...perm }));
  }
}
