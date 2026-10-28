import type { UnitOfWork } from "../unit-of-work";

export type UnitOfWorkHook = () => void | Promise<void>;

export class InMemoryUnitOfWork implements UnitOfWork {
  private active = false;
  private readonly commitHooks: UnitOfWorkHook[] = [];
  private readonly rollbackHooks: UnitOfWorkHook[] = [];

  async begin(): Promise<void> {
    if (this.active) {
      throw new Error("Transaction is already active");
    }
    this.active = true;
  }

  onCommit(hook: UnitOfWorkHook): void {
    this.commitHooks.push(hook);
  }

  onRollback(hook: UnitOfWorkHook): void {
    this.rollbackHooks.push(hook);
  }

  async commit(): Promise<void> {
    if (!this.active) {
      throw new Error("Cannot commit an inactive transaction");
    }
    this.active = false;
    try {
      for (const hook of this.commitHooks.splice(0)) {
        await hook();
      }
    } finally {
      this.rollbackHooks.length = 0;
    }
  }

  async rollback(): Promise<void> {
    if (!this.active) {
      return;
    }
    this.active = false;
    try {
      for (const hook of this.rollbackHooks.splice(0).reverse()) {
        await hook();
      }
    } finally {
      this.commitHooks.length = 0;
    }
  }

  isActive(): boolean {
    return this.active;
  }
}
