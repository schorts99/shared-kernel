import type { BaseResource } from "../rbac/index.js";

export type Predicate<User extends { id: unknown }, Resource extends BaseResource> = (user: User, resource: Resource) => boolean;

export type AsyncPredicate<User extends { id: unknown }, Resource extends BaseResource> = (user: User, resource: Resource) => Promise<boolean>;

export type ContextualPredicate<User extends { id: unknown }, Resource extends BaseResource, Context = {}> = (user: User, resource: Resource, context?: Context) => boolean;

export type AsyncContextualPredicate<User extends { id: unknown }, Resource extends BaseResource, Context = {}> = (user: User, resource: Resource, context?: Context) => Promise<boolean>;

export type PredicateResult = boolean | Promise<boolean>;
