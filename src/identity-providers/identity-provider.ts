export interface IdentityProvider<IdentityUser> {
  createUser(...args: any[]): Promise<IdentityUser>;
  verifyToken(token: string): Promise<{ userId: string; claims: Record<string, any> }>;
  getUser(userId: string): Promise<IdentityUser>;
  getUsers(userIds: Array<string>): Promise<IdentityUser[]>;
}
