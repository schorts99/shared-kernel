import { Entity } from "../entities";
import { BaseModel } from "../models";

export interface AuthProvider<UserEntity extends Entity<BaseModel>> {
  authenticate(...args: any[]): Promise<void>;
  logout(): Promise<void>;
  isAuthenticated(): Promise<boolean>;
  currentUser(): Promise<UserEntity | null>;
  onAuthChange(callback: (user: UserEntity | null) => void): () => void;
}
