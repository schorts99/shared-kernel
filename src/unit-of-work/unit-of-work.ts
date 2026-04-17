export interface UnitOfWork {
  begin(): Promise<void>;

  commit(): Promise<void>;

  rollback(): Promise<void>;

  isActive(): boolean;
}
