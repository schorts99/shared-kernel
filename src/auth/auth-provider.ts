import { Entity } from "../entities";
import { Model } from "../models";
import { ValueObject } from "../value-objects";
import { MaybePromise } from "../types";
import { Permission } from "../rbac";

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

export interface UserSession<UserEntity extends Entity<ValueObject, Model>> {
  user: UserEntity;
  token: string;
  permissions: Permission[];
  expiresAt?: Date;
  refreshToken?: string;
}

export type AuthChangeCallback<UserEntity extends Entity<ValueObject, Model>> = 
  (user: UserEntity | null) => void | Promise<void>;

export type AuthChangeUnsubscribe = () => void;

export interface AuthProvider<
  UserEntity extends Entity<ValueObject, Model>,
  IsAsync extends boolean = false
> {
  authenticate(credentials: AuthCredentials): MaybePromise<IsAsync, AuthenticationResult>;

  logout(): MaybePromise<IsAsync, void>;

  isAuthenticated(): MaybePromise<IsAsync, boolean>;

  getCurrentUser(): MaybePromise<IsAsync, UserEntity | null>;

  getCurrentUserPermissions(): MaybePromise<IsAsync, Permission[]>;

  getCurrentSession(): MaybePromise<IsAsync, UserSession<UserEntity> | null>;

  refreshToken(
    refreshToken?: string
  ): MaybePromise<IsAsync, AuthenticationResult>;

  revokeToken(token?: string): MaybePromise<IsAsync, void>;

  onAuthChange(callback: AuthChangeCallback<UserEntity>): AuthChangeUnsubscribe;
}
