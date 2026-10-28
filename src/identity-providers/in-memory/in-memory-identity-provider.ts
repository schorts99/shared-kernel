import { cloneValue } from "../../utils";
import {
  CreateUserRequest,
  IdentityProvider,
  IdentityUserBase,
  UpdateUserRequest,
} from "../identity-provider";

export interface InMemoryIdentityProviderOptions<T extends IdentityUserBase = IdentityUserBase> {
  users?: T[];
  userFactory?: (base: IdentityUserBase, request: CreateUserRequest) => T;
}

export class InMemoryIdentityProvider<T extends IdentityUserBase = IdentityUserBase>
  implements IdentityProvider<T>
{
  private readonly users = new Map<string, T>();
  private readonly passwords = new Map<string, string>();
  private readonly tokens = new Map<string, { userId: string; claims?: Record<string, any> | undefined }>();
  private readonly userFactory: ((base: IdentityUserBase, request: CreateUserRequest) => T) | undefined;

  constructor(options: InMemoryIdentityProviderOptions<T> = {}) {
    this.userFactory = options.userFactory;
    options.users?.forEach(user => {
      this.users.set(user.id, cloneValue(user));
    });
  }

  async createUser(request: CreateUserRequest): Promise<T> {
    for (const existing of this.users.values()) {
      if (existing.email === request.email) {
        throw new Error(`User with email "${request.email}" already exists`);
      }
    }

    const id =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

    const baseUser: IdentityUserBase = {
      id,
      email: request.email,
      emailVerified: request.emailVerified ?? false,
      ...(request.displayName !== undefined ? { displayName: request.displayName } : {}),
      disabled: false,
      metadata: {
        creationTime: new Date().toISOString(),
      },
    };

    const user = this.userFactory ? this.userFactory(baseUser, request) : (baseUser as T);
    this.users.set(id, cloneValue(user));

    if (request.password !== undefined) {
      this.passwords.set(id, request.password);
    }

    return cloneValue(user);
  }

  async updateUser(userId: string, request: UpdateUserRequest): Promise<T> {
    const existing = this.users.get(userId);
    if (!existing) {
      throw new Error(`User with id "${userId}" not found`);
    }

    if (request.email !== undefined && request.email !== existing.email) {
      for (const other of this.users.values()) {
        if (other.id !== userId && other.email === request.email) {
          throw new Error(`User with email "${request.email}" already exists`);
        }
      }
    }

    const updated: T = {
      ...cloneValue(existing),
      ...(request.email !== undefined ? { email: request.email } : {}),
      ...(request.displayName !== undefined ? { displayName: request.displayName } : {}),
      ...(request.emailVerified !== undefined ? { emailVerified: request.emailVerified } : {}),
      ...(request.disabled !== undefined ? { disabled: request.disabled } : {}),
    };

    this.users.set(userId, cloneValue(updated));

    if (request.password !== undefined) {
      this.passwords.set(userId, request.password);
    }

    return cloneValue(updated);
  }

  async deleteUser(userId: string): Promise<void> {
    if (!this.users.has(userId)) {
      throw new Error(`User with id "${userId}" not found`);
    }

    this.users.delete(userId);
    this.passwords.delete(userId);

    for (const [token, entry] of this.tokens.entries()) {
      if (entry.userId === userId) {
        this.tokens.delete(token);
      }
    }
  }

  async getUser(userId: string): Promise<T> {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error(`User with id "${userId}" not found`);
    }

    return cloneValue(user);
  }

  async getUsers(userIds: string[]): Promise<T[]> {
    const result: T[] = [];
    for (const id of userIds) {
      const user = this.users.get(id);
      if (user) {
        result.push(cloneValue(user));
      }
    }
    return result;
  }

  issueToken(userId: string, customToken?: string, extraClaims?: Record<string, any>): string {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error(`User with id "${userId}" not found`);
    }

    const token =
      customToken ??
      `idp_token_${userId}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

    this.tokens.set(token, {
      userId,
      claims: extraClaims ? cloneValue(extraClaims) : undefined,
    });

    return token;
  }

  async verifyToken(token: string): Promise<{ userId: string; claims: Record<string, any> }> {
    const tokenEntry = this.tokens.get(token);
    if (!tokenEntry) {
      throw new Error("Invalid or expired identity token");
    }

    const user = this.users.get(tokenEntry.userId);
    if (!user) {
      throw new Error(`User for token no longer exists`);
    }

    if (user.disabled) {
      throw new Error(`User "${user.id}" is disabled`);
    }

    return {
      userId: user.id,
      claims: cloneValue({
        ...(user.customClaims ?? {}),
        ...(tokenEntry.claims ?? {}),
      }),
    };
  }

  async setCustomClaims(userId: string, claims: Record<string, any>): Promise<void> {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error(`User with id "${userId}" not found`);
    }

    const updated: T = {
      ...cloneValue(user),
      customClaims: cloneValue(claims),
    };

    this.users.set(userId, updated);
  }
}
