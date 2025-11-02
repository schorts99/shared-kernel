import { Entity } from "../entities";
import { Model } from "../models";
import { ValueObject } from "../value-objects";

export interface AuthProvider<UserEntity extends Entity<ValueObject, Model>> {
  authenticate(...args: any[]): Promise<string>;
  logout(): Promise<void>;
  isAuthenticated(): Promise<boolean>;
  getCurrentUser(): Promise<UserEntity | null>;
  onAuthChange(callback: (user: UserEntity | null) => void): () => void;
}
