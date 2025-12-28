export interface IdentityProvider<IdentityUser> {
  createUser(): Promise<{ providerId: string }>;
  authenticate(email: string, password: string): Promise<{ token: string }>;
  verifyToken(token: string): Promise<{ userId: string; claims: Record<string, any> }>;
  getUser(userId: string): Promise<IdentityUser>;
}
