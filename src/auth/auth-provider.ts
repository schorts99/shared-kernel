import { Entity } from "../entities/index.js";
import { AggregateRoot } from "../aggregates/index.js";
import { Model } from "../models/index.js";
import { ValueObject } from "../value-objects/index.js";
import { Permission, BaseAction } from "../rbac/index.js";

export type Authenticatable = Entity<ValueObject, Model> | AggregateRoot<ValueObject>;

export interface AuthCredentials {
  username?: string;
  email?: string;
  password?: string;
  token?: string;
  [key: string]: unknown;
}

export interface AuthenticationResult {
  token: string;
  expiresAt?: Date;
  refreshToken?: string;
}

export interface UserSession<
  User extends Authenticatable = Authenticatable,
  Action extends string = BaseAction,
  Role extends string = string
> {
  user: User;
  token: string;
  roles: Role[];
  permissions: Permission<Action>[];
  expiresAt?: Date;
  refreshToken?: string;
}

export type AuthChangeCallback<
  User extends Authenticatable = Authenticatable,
  Action extends string = BaseAction,
  Role extends string = string
> = (
  session: UserSession<User, Action, Role> | null
) => void | Promise<void>;

export type AuthChangeUnsubscribe = () => void;

export interface AuthProvider<
  User extends Authenticatable = Authenticatable,
  Action extends string = BaseAction,
  Role extends string = string
> {
  authenticate(credentials: AuthCredentials): Promise<AuthenticationResult>;
  logout(): Promise<void>;
  isAuthenticated(): Promise<boolean>;
  getCurrentUser(): Promise<User | null>;
  getCurrentUserRoles(): Promise<Role[]>;
  getCurrentUserPermissions(): Promise<Permission<Action>[]>;
  getCurrentSession(): Promise<UserSession<User, Action, Role> | null>;
  refreshToken(refreshToken?: string): Promise<AuthenticationResult>;
  refreshCurrentUser(): Promise<User | null>;
  revokeToken(token?: string): Promise<void>;
  onAuthChange(callback: AuthChangeCallback<User, Action, Role>): AuthChangeUnsubscribe;
}
