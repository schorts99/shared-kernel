export interface IdentityUserBase {
  id: string;
  email: string;
  emailVerified: boolean;
  displayName?: string;
  disabled: boolean;
  metadata: {
    creationTime: string;
    lastSignInTime?: string;
  };
  customClaims?: Record<string, any>;
}

export interface CreateUserRequest {
  email: string;
  password?: string;
  displayName?: string;
  emailVerified?: boolean;
}

export interface UpdateUserRequest extends Partial<CreateUserRequest> {
  disabled?: boolean;
}

export interface IdentityProvider<T extends IdentityUserBase = IdentityUserBase> {
  createUser(request: CreateUserRequest): Promise<T>;
  updateUser(userId: string, request: UpdateUserRequest): Promise<T>;
  deleteUser(userId: string): Promise<void>;
  getUser(userId: string): Promise<T>;
  getUsers(userIds: string[]): Promise<T[]>;
  verifyToken(token: string): Promise<{ userId: string; claims: Record<string, any> }>;
  setCustomClaims(userId: string, claims: Record<string, any>): Promise<void>;
}
