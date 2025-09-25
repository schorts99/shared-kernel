import { RequireAuth, NotAuthenticated } from '../../src/auth';

class FakeAuthProvider {
  constructor(private authenticated: boolean) {}
  async isAuthenticated() {
    return this.authenticated;
  }
}

class TestService {
  authProvider: FakeAuthProvider;

  constructor(authenticated: boolean) {
    this.authProvider = new FakeAuthProvider(authenticated);
  }

  async securedMethod(): Promise<string> {
    return 'should not reach';
  }
}

describe('RequireAuth decorator (manual application)', () => {
  it('should throw NotAuthenticated when not authenticated and no onFail', async () => {
    const service = new TestService(false);
    const originalMethod = service.securedMethod;
    const decorated = RequireAuth()(originalMethod, {
      kind: 'method',
      name: 'securedMethod',
      access: { has: () => true, get: () => originalMethod },
      static: false,
      private: false,
      addInitializer: () => {},
      metadata: {
        get: () => undefined,
        set: () => {},
      },
    });
    service.securedMethod = decorated.bind(service);

    await expect(service.securedMethod()).rejects.toThrow(NotAuthenticated);
  });

  it('should return fallback value when not authenticated and onFail is provided', async () => {
    const service = new TestService(false);
    const fallback = () => 'fallback';
    const originalMethod = service.securedMethod;
    const decorated = RequireAuth(fallback)(originalMethod, {
      kind: 'method',
      name: 'securedMethod',
      access: { has: () => true, get: () => originalMethod },
      static: false,
      private: false,
      addInitializer: () => {},
      metadata: {
        get: () => undefined,
        set: () => {},
      },
    });
    service.securedMethod = decorated.bind(service);
    const result = await service.securedMethod();

    expect(result).toBe('fallback');
  });

  it('should call original method when authenticated', async () => {
    const service = new TestService(true);
    const originalMethod = service.securedMethod;
    const decorated = RequireAuth()(originalMethod, {
      kind: 'method',
      name: 'securedMethod',
      access: { has: () => true, get: () => originalMethod },
      static: false,
      private: false,
      addInitializer: () => {},
      metadata: {
        get: () => undefined,
        set: () => {},
      },
    });
    service.securedMethod = decorated.bind(service);
    const result = await service.securedMethod();

    expect(result).toBe('should not reach');
  });
});
