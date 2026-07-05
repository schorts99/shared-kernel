import { Entity } from "../entities";
import { Model } from "../models";
import { ValueObject } from "../value-objects";
import { Permission, BaseAction } from "../rbac";

export interface AuthCredentials {
  username?: string;
  email?: string;
  password?: string;
  token?: string;
  [key: string]: any;
}

export interface AuthenticationResult {
  token: string;
 expiresAt?: Date;
  refreshToken?: string;
}

export interface UserSession<
  UserEntity extends Entity<ValueObject, Model>,
  Action extends string = BaseAction,
  Role extends string = string
> {
  user: UserEntity;
  token: string;
  roles: Role[];
  permissions: Permission<Action>[];
  expiresAt?: Date;
  refreshToken?: string;
}

export type AuthChangeCallback<
  UserEntity extends Entity<ValueObject, Model>,
  Action extends string = BaseAction,
  Role extends string = string
> = (
  session: UserSession<UserEntity, Action, Role> | null
) => void | Promise<void>;

export type AuthChangeUnsubscribe = () => void;

export interface AuthProvider<
  UserEntity extends Entity<ValueObject, Model>,
  Action extends string = BaseAction,
  Role extends string = string
> {
  authenticate(credentials: AuthCredentials): Promise<AuthenticationResult>;
  logout(): Promise<void>;
  isAuthenticated(): Promise<boolean>;
  getCurrentUser(): Promise<UserEntity | null>;
  getCurrentUserRoles(): Promise<Role[]>;
  getCurrentUserPermissions(): Promise<Permission<Action>[]>;
  getCurrentSession(): Promise<UserSession<UserEntity, Action, Role> | null>;
  refreshToken(refreshToken?: string): Promise<AuthenticationResult>;
  refreshCurrentUser(): Promise<UserEntity | null>;
  revokeToken(token?: string): Promise<void>;
  onAuthChange(callback: AuthChangeCallback<UserEntity, Action, Role>): AuthChangeUnsubscribe;
}
