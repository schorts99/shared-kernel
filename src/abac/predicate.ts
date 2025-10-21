import type { BaseResource } from '../rbac/base-resource';

export type Predicate<User extends { id: string }, Resource extends BaseResource> = (user: User, resource: Resource) => boolean;
