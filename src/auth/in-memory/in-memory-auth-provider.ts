import { BaseAction, Permission } from "../../rbac";
import { cloneValue } from "../../utils";
import {
  AuthChangeCallback,
  AuthChangeUnsubscribe,
  AuthCredentials,
  Authenticatable,
  AuthenticationResult,
  AuthProvider,
  UserSession,
} from "../auth-provider";
import { AuthenticationError } from "../exceptions";

export interface InMemoryAuthUserRecord<
  User extends Authenticatable = Authenticatable,
  Action extends string = BaseAction,
  Role extends string = string
> {
  user: User;
  username?: string;
  email?: string;
  password?: string;
  token?: string;
  roles?: Role[];
  permissions?: Permission<Action>[];
}

export interface InMemoryAuthProviderOptions<
  User extends Authenticatable = Authenticatable,
  Action extends string = BaseAction,
  Role extends string = string
> {
  users?: InMemoryAuthUserRecord<User, Action, Role>[];
  tokenTtlMs?: number;
}

export class InMemoryAuthProvider<
  User extends Authenticatable = Authenticatable,
  Action extends string = BaseAction,
  Role extends string = string
> implements AuthProvider<User, Action, Role>
{
  private readonly users = new Map<string, InMemoryAuthUserRecord<User, Action, Role>>();
  private readonly refreshTokens = new Map<string, string>();
  private readonly revokedTokens = new Set<string>();
  private readonly listeners = new Set<AuthChangeCallback<User, Action, Role>>();
  private readonly tokenTtlMs: number;
  private currentSession: UserSession<User, Action, Role> | null = null;

  constructor(options: InMemoryAuthProviderOptions<User, Action, Role> = {}) {
    this.tokenTtlMs = options.tokenTtlMs ?? 3600_000;
    options.users?.forEach(record => this.registerUser(record));
  }

  registerUser(record: InMemoryAuthUserRecord<User, Action, Role>): void {
    const userId = String(record.user.id.value);
    this.users.set(userId, cloneValue(record));
  }

  async setSession(session: UserSession<User, Action, Role> | null): Promise<void> {
    this.currentSession = session ? cloneValue(session) : null;
    if (session?.refreshToken) {
      this.refreshTokens.set(session.refreshToken, String(session.user.id.value));
    }
    await this.notifyListeners();
  }

  async authenticate(credentials: AuthCredentials): Promise<AuthenticationResult> {
    const record = this.findMatchingRecord(credentials);
    if (!record) {
      throw new AuthenticationError("Invalid credentials", "INVALID_CREDENTIALS");
    }

    const token = this.generateToken("access");
    const refreshToken = this.generateToken("refresh");
    const expiresAt = new Date(Date.now() + this.tokenTtlMs);
    const userId = String(record.user.id.value);

    this.refreshTokens.set(refreshToken, userId);

    this.currentSession = {
      user: cloneValue(record.user),
      token,
      refreshToken,
      expiresAt,
      roles: cloneValue(record.roles ?? []),
      permissions: cloneValue(record.permissions ?? []),
    };

    await this.notifyListeners();

    return {
      token,
      refreshToken,
      expiresAt: new Date(expiresAt.getTime()),
    };
  }

  async logout(): Promise<void> {
    if (this.currentSession) {
      this.revokedTokens.add(this.currentSession.token);
      if (this.currentSession.refreshToken) {
        this.revokedTokens.add(this.currentSession.refreshToken);
        this.refreshTokens.delete(this.currentSession.refreshToken);
      }
      this.currentSession = null;
      await this.notifyListeners();
    }
  }

  async isAuthenticated(): Promise<boolean> {
    const session = await this.getValidSession();
    return session !== null;
  }

  async getCurrentUser(): Promise<User | null> {
    const session = await this.getValidSession();
    return session ? cloneValue(session.user) : null;
  }

  async getCurrentUserRoles(): Promise<Role[]> {
    const session = await this.getValidSession();
    return session ? cloneValue(session.roles) : [];
  }

  async getCurrentUserPermissions(): Promise<Permission<Action>[]> {
    const session = await this.getValidSession();
    return session ? cloneValue(session.permissions) : [];
  }

  async getCurrentSession(): Promise<UserSession<User, Action, Role> | null> {
    const session = await this.getValidSession();
    return session ? cloneValue(session) : null;
  }

  async refreshToken(refreshToken?: string): Promise<AuthenticationResult> {
    const tokenToUse = refreshToken ?? this.currentSession?.refreshToken;
    if (!tokenToUse || this.revokedTokens.has(tokenToUse)) {
      throw new AuthenticationError("Invalid or revoked refresh token", "INVALID_REFRESH_TOKEN");
    }

    const userId = this.refreshTokens.get(tokenToUse);
    const record = userId ? this.users.get(userId) : undefined;
    const baseUser = record?.user ?? this.currentSession?.user;
    if (!baseUser) {
      throw new AuthenticationError("Unable to resolve user for refresh token", "INVALID_REFRESH_TOKEN");
    }

    this.refreshTokens.delete(tokenToUse);
    this.revokedTokens.add(tokenToUse);

    const newAccessToken = this.generateToken("access");
    const newRefreshToken = this.generateToken("refresh");
    const expiresAt = new Date(Date.now() + this.tokenTtlMs);

    this.refreshTokens.set(newRefreshToken, String(baseUser.id.value));

    this.currentSession = {
      user: cloneValue(baseUser),
      token: newAccessToken,
      refreshToken: newRefreshToken,
      expiresAt,
      roles: cloneValue(record?.roles ?? this.currentSession?.roles ?? []),
      permissions: cloneValue(record?.permissions ?? this.currentSession?.permissions ?? []),
    };

    await this.notifyListeners();

    return {
      token: newAccessToken,
      refreshToken: newRefreshToken,
      expiresAt: new Date(expiresAt.getTime()),
    };
  }

  async refreshCurrentUser(): Promise<User | null> {
    const session = await this.getValidSession();
    if (!session) {
      return null;
    }

    const userId = String(session.user.id.value);
    const record = this.users.get(userId);
    if (record) {
      this.currentSession = {
        ...session,
        user: cloneValue(record.user),
        roles: cloneValue(record.roles ?? session.roles),
        permissions: cloneValue(record.permissions ?? session.permissions),
      };
    }

    return cloneValue(this.currentSession!.user);
  }

  async revokeToken(token?: string): Promise<void> {
    const targetToken = token ?? this.currentSession?.token;
    if (!targetToken) {
      return;
    }

    this.revokedTokens.add(targetToken);
    this.refreshTokens.delete(targetToken);

    if (
      this.currentSession &&
      (this.currentSession.token === targetToken || this.currentSession.refreshToken === targetToken)
    ) {
      this.currentSession = null;
      await this.notifyListeners();
    }
  }

  onAuthChange(callback: AuthChangeCallback<User, Action, Role>): AuthChangeUnsubscribe {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  private async getValidSession(): Promise<UserSession<User, Action, Role> | null> {
    if (!this.currentSession) {
      return null;
    }

    if (this.revokedTokens.has(this.currentSession.token)) {
      this.currentSession = null;
      await this.notifyListeners();
      return null;
    }

    if (this.currentSession.expiresAt && this.currentSession.expiresAt.getTime() <= Date.now()) {
      this.currentSession = null;
      await this.notifyListeners();
      return null;
    }

    return this.currentSession;
  }

  private findMatchingRecord(
    credentials: AuthCredentials
  ): InMemoryAuthUserRecord<User, Action, Role> | undefined {
    for (const record of this.users.values()) {
      if (credentials.token !== undefined) {
        if (record.token && record.token === credentials.token && !this.revokedTokens.has(credentials.token)) {
          return record;
        }
        continue;
      }

      const emailMatches =
        credentials.email !== undefined && record.email !== undefined && record.email === credentials.email;
      const usernameMatches =
        credentials.username !== undefined &&
        record.username !== undefined &&
        record.username === credentials.username;

      if (emailMatches || usernameMatches) {
        if (record.password === undefined || record.password === credentials.password) {
          return record;
        }
      }
    }

    return undefined;
  }

  private async notifyListeners(): Promise<void> {
    const snapshot = this.currentSession ? cloneValue(this.currentSession) : null;
    for (const listener of Array.from(this.listeners)) {
      await listener(snapshot ? cloneValue(snapshot) : null);
    }
  }

  private generateToken(prefix: string): string {
    const id =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    return `${prefix}_${id}`;
  }
}
