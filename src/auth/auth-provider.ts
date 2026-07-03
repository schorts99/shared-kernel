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
  Action extends string = BaseAction
> {
  user: UserEntity;
  token: string;
  permissions: Permission<Action>[];
  expiresAt?: Date;
  refreshToken?: string;
}

export type AuthChangeCallback<UserEntity extends Entity<ValueObject, Model>> =
  (user: UserEntity | null) => void | Promise<void>;

export type AuthChangeUnsubscribe = () => void;

export interface AuthProvider<
  UserEntity extends Entity<ValueObject, Model>,
  Action extends string = BaseAction
> {
  authenticate(credentials: AuthCredentials): Promise<AuthenticationResult>;

  logout(): Promise<void>;

  isAuthenticated(): Promise<boolean>;

  getCurrentUser(): Promise<UserEntity | null>;

  getCurrentUserPermissions(): Promise<Permission<Action>[]>;

  getCurrentSession(): Promise<UserSession<UserEntity, Action> | null>;

  refreshToken(refreshToken?: string): Promise<AuthenticationResult>;

  revokeToken(token?: string): Promise<void>;

  onAuthChange(callback: AuthChangeCallback<UserEntity>): AuthChangeUnsubscribe;
}
