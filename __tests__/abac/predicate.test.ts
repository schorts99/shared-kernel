import { Predicate, AsyncPredicate, ContextualPredicate, AsyncContextualPredicate, PredicateResult } from "../../src/abac";

interface TestUser {
  id: string;
  role: string;
  department: string;
}

interface TestResource {
  name: string;
  ownerId: string;
  sensitivity: 'public' | 'internal' | 'confidential';
  tags: string[];
}

const testUser: TestUser = {
  id: "user-123",
  role: "manager",
  department: "engineering"
};

const testResource: TestResource = {
  name: "project-alpha",
  ownerId: "user-123",
  sensitivity: "internal",
  tags: ["engineering", "confidential"]
};

describe("ABAC Predicates", () => {
  describe("Predicate (synchronous)", () => {
    it("should evaluate user ownership", () => {
      const isOwner: Predicate<TestUser, TestResource> = (user, resource) =>
        user.id === resource.ownerId;

      expect(isOwner(testUser, testResource)).toBe(true);

      const otherUser = { ...testUser, id: "user-456" };

      expect(isOwner(otherUser, testResource)).toBe(false);
    });

    it("should evaluate role-based access", () => {
      const isManager: Predicate<TestUser, TestResource> = (user) =>
        user.role === "manager";

      expect(isManager(testUser, testResource)).toBe(true);

      const employee = { ...testUser, role: "employee" };

      expect(isManager(employee, testResource)).toBe(false);
    });

    it("should evaluate resource sensitivity", () => {
      const canAccessSensitive: Predicate<TestUser, TestResource> = (user, resource) =>
        resource.sensitivity !== 'confidential' || user.role === 'manager';

      expect(canAccessSensitive(testUser, testResource)).toBe(true);

      const sensitiveResource = { ...testResource, sensitivity: 'confidential' as const };

      expect(canAccessSensitive(testUser, sensitiveResource)).toBe(true);

      const employee = { ...testUser, role: "employee" };

      expect(canAccessSensitive(employee, sensitiveResource)).toBe(false);
    });

    it("should evaluate department access", () => {
      const sameDepartment: Predicate<TestUser, TestResource> = (user, resource) =>
        resource.tags.includes(user.department);

      expect(sameDepartment(testUser, testResource)).toBe(true);

      const otherDeptUser = { ...testUser, department: "sales" };

      expect(sameDepartment(otherDeptUser, testResource)).toBe(false);
    });
  });

  describe("AsyncPredicate", () => {
    it("should handle asynchronous evaluation", async () => {
      const asyncCheck: AsyncPredicate<TestUser, TestResource> = async (user, resource) => {
        await new Promise(resolve => setTimeout(resolve, 1));

        return user.id === resource.ownerId;
      };

      const result = await asyncCheck(testUser, testResource);

      expect(result).toBe(true);
    });

    it("should handle async role validation", async () => {
      const asyncRoleCheck: AsyncPredicate<TestUser, TestResource> = async (user) => {
        await new Promise(resolve => setTimeout(resolve, 1));

        return ['admin', 'manager'].includes(user.role);
      };

      expect(await asyncRoleCheck(testUser, testResource)).toBe(true);

      const employee = { ...testUser, role: "employee" };

      expect(await asyncRoleCheck(employee, testResource)).toBe(false);
    });
  });

  describe("ContextualPredicate", () => {
    interface AccessContext {
      currentTime: Date;
      requestId: string;
      ipAddress: string;
    }

    it("should use context for time-based access", () => {
      const timeBasedAccess: ContextualPredicate<TestUser, TestResource, AccessContext> =
        (_, resource, context) => {
          if (!context) return false;

          const hour = context.currentTime.getHours();

          if (resource.sensitivity === 'confidential') {
            return hour >= 9 && hour <= 17;
          }

          return true;
        };

      const businessHours = new Date();

      businessHours.setHours(14);

      const afterHours = new Date();

      afterHours.setHours(20);

      const context: AccessContext = {
        currentTime: businessHours,
        requestId: "req-123",
        ipAddress: "192.168.1.1"
      };

      expect(timeBasedAccess(testUser, testResource, context)).toBe(true);

      const sensitiveResource = { ...testResource, sensitivity: 'confidential' as const };

      expect(timeBasedAccess(testUser, sensitiveResource, context)).toBe(true);

      const afterHoursContext = { ...context, currentTime: afterHours };

      expect(timeBasedAccess(testUser, sensitiveResource, afterHoursContext)).toBe(false);
    });

    it("should handle optional context", () => {
      const optionalContextPredicate: ContextualPredicate<TestUser, TestResource, AccessContext> =
        (user, _, context) => {
          if (!context) {
            return user.role === 'manager';
          }

          return user.role === 'manager' && context.ipAddress.startsWith('192.168.');
        };

      expect(optionalContextPredicate(testUser, testResource)).toBe(true);

      const context: AccessContext = {
        currentTime: new Date(),
        requestId: "req-123",
        ipAddress: "192.168.1.1"
      };

      expect(optionalContextPredicate(testUser, testResource, context)).toBe(true);

      const externalContext = { ...context, ipAddress: "203.0.113.1" };

      expect(optionalContextPredicate(testUser, testResource, externalContext)).toBe(false);
    });

    it("should support async contextual evaluation", async () => {
      const asyncContextual: AsyncContextualPredicate<TestUser, TestResource, AccessContext> =
        async (user, resource, context) => {
          if (!context) return false;

          await new Promise(resolve => setTimeout(resolve, 1));

          return user.id === resource.ownerId && context.ipAddress !== 'blocked-ip';
        };

      const context: AccessContext = {
        currentTime: new Date(),
        requestId: "req-123",
        ipAddress: "192.168.1.1"
      };

      const result = await asyncContextual(testUser, testResource, context);

      expect(result).toBe(true);

      const blockedContext = { ...context, ipAddress: "blocked-ip" };
      const blockedResult = await asyncContextual(testUser, testResource, blockedContext);

      expect(blockedResult).toBe(false);
    });
  });

  describe("AsyncContextualPredicate", () => {
    interface AccessContext {
      currentTime: Date;
      requestId: string;
      ipAddress: string;
    }

    it("should handle async contextual evaluation with explicit typing", async () => {
      const asyncContextualPredicate: AsyncContextualPredicate<TestUser, TestResource, AccessContext> =
        async (user, resource, context) => {
          if (!context) return false;

          await new Promise(resolve => setTimeout(resolve, 1));

          const isOwner = user.id === resource.ownerId;
          const isBusinessHours = context.currentTime.getHours() >= 9 && context.currentTime.getHours() <= 17;
          const isAllowedIP = !context.ipAddress.startsWith('10.');

          return isOwner && isBusinessHours && isAllowedIP;
        };

      const businessHoursContext: AccessContext = {
        currentTime: new Date('2024-01-01T14:00:00'),
        requestId: "req-123",
        ipAddress: "192.168.1.1"
      };

      expect(await asyncContextualPredicate(testUser, testResource, businessHoursContext)).toBe(true);

      const afterHoursContext = { ...businessHoursContext, currentTime: new Date('2024-01-01T20:00:00') };

      expect(await asyncContextualPredicate(testUser, testResource, afterHoursContext)).toBe(false);

      const blockedIPContext = { ...businessHoursContext, ipAddress: "10.0.0.1" };

      expect(await asyncContextualPredicate(testUser, testResource, blockedIPContext)).toBe(false);
    });

    it("should handle optional context parameter", async () => {
      const flexiblePredicate: AsyncContextualPredicate<TestUser, TestResource, AccessContext> =
        async (user, resource, context) => {
          if (!context) {
            return user.id === resource.ownerId;
          }

          await new Promise(resolve => setTimeout(resolve, 1));

          const isBusinessHours = context.currentTime.getHours() >= 9 && context.currentTime.getHours() <= 17;

          return user.id === resource.ownerId && isBusinessHours;
        };

      expect(await flexiblePredicate(testUser, testResource)).toBe(true);

      const businessContext: AccessContext = {
        currentTime: new Date('2024-01-01T14:00:00'),
        requestId: "req-123",
        ipAddress: "192.168.1.1"
      };

      expect(await flexiblePredicate(testUser, testResource, businessContext)).toBe(true);

      const afterHoursContext = { ...businessContext, currentTime: new Date('2024-01-01T20:00:00') };

      expect(await flexiblePredicate(testUser, testResource, afterHoursContext)).toBe(false);
    });

    it("should integrate with complex business logic", async () => {
      interface SecurityContext {
        clearanceLevel: number;
        department: string;
        sessionId: string;
      }

      const securityPredicate: AsyncContextualPredicate<TestUser, TestResource, SecurityContext> =
        async (user, resource, context) => {
          if (!context) return false;

          await new Promise(resolve => setTimeout(resolve, 1));

          const departmentMatch = user.department === context.department;
          const clearanceMatch = context.clearanceLevel >= (resource.sensitivity === 'confidential' ? 3 : 1);
          const sessionValid = context.sessionId.startsWith('valid-');

          return departmentMatch && clearanceMatch && sessionValid;
        };

      const securityContext: SecurityContext = {
        clearanceLevel: 3,
        department: "engineering",
        sessionId: "valid-session-123"
      };

      expect(await securityPredicate(testUser, testResource, securityContext)).toBe(true);

      const lowClearanceContext = { ...securityContext, clearanceLevel: 1 };

      expect(await securityPredicate(testUser, { ...testResource, sensitivity: 'confidential' }, lowClearanceContext)).toBe(false);

      const invalidSessionContext = { ...securityContext, sessionId: "invalid-session" };

      expect(await securityPredicate(testUser, testResource, invalidSessionContext)).toBe(false);
    });
  });

  describe("PredicateResult type", () => {
    it("should accept both sync and async results", () => {
      const syncResult: PredicateResult = true;
      const asyncResult: PredicateResult = Promise.resolve(false);

      expect(syncResult).toBe(true);
      expect(asyncResult).toBeInstanceOf(Promise);
    });
  });

  describe("Integration with RBAC", () => {
    it("should work with RBAC policy methods", () => {
      const ownershipPredicate: Predicate<TestUser, TestResource> = (user, resource) =>
        user.id === resource.ownerId;
      const departmentPredicate: Predicate<TestUser, TestResource> = (user, resource) =>
        resource.tags.includes(user.department);
      const canAccess = (user: TestUser, resource: TestResource, predicates: Predicate<TestUser, TestResource>[]) => {
        return predicates.every(predicate => predicate(user, resource));
      };

      expect(canAccess(testUser, testResource, [ownershipPredicate, departmentPredicate])).toBe(true);

      const otherUser = { ...testUser, id: "user-456" };

      expect(canAccess(otherUser, testResource, [ownershipPredicate, departmentPredicate])).toBe(false);
    });
  });
});