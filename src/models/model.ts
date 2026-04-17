export type ModelId = string | number;

export interface Identifiable<ID extends ModelId = ModelId> {
  readonly id: ID;
}

export interface Auditable {
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface SoftDeletable {
  readonly deletedAt?: string | null;
}

export type Model<T = Record<string, any>, ID extends ModelId = ModelId> = Identifiable<ID> & T;

export type AuditableModel<T = Record<string, any>, ID extends ModelId = ModelId> = Model<T, ID> & Auditable;

export type FullModel<T = Record<string, any>, ID extends ModelId = ModelId> = AuditableModel<T, ID> & SoftDeletable;

export type ModelAttributes<M extends Model> = Omit<M, keyof Identifiable | keyof Auditable | keyof SoftDeletable>;

export function isIdentifiable(value: unknown): value is Identifiable {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    (typeof (value as any).id === "string" || typeof (value as any).id === "number")
  );
}

export function getModelAttributes<M extends Model>(model: M): ModelAttributes<M> {
  const { id, createdAt, updatedAt, deletedAt, ...attributes } = model as any;

  return attributes as ModelAttributes<M>;
}
