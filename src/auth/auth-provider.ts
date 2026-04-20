import { Entity } from "../entities";
import { Model } from "../models";
import { ValueObject } from "../value-objects";
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
  UserEntity extends Entity<ValueObject, Model>
> {
  authenticate(credentials: AuthCredentials): Promise<AuthenticationResult>;

  logout(): Promise<void>;

  isAuthenticated(): Promise<boolean>;

  getCurrentUser(): Promise<UserEntity | null>;

  getCurrentUserPermissions(): Promise<Permission[]>;

  getCurrentSession(): Promise<UserSession<UserEntity> | null>;

  refreshToken(
    refreshToken?: string
  ): Promise<AuthenticationResult>;

  revokeToken(token?: string): Promise<void>;

  onAuthChange(callback: AuthChangeCallback<UserEntity>): AuthChangeUnsubscribe;
}
