export interface IdentityProvider<IdentityUser> {
  createUser(): Promise<{ providerId: string }>;
  verifyToken(token: string): Promise<{ userId: string; claims: Record<string, any> }>;
  getUser(userId: string): Promise<IdentityUser>;
  getUsers(userIds: Array<string>): Promise<IdentityUser[]>;
}
