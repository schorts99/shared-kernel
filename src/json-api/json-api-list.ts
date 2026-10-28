export type JSONAPIList<EntityAttributes> = {
  data: Array<{
    id: string;
    type: string;
    attributes: Omit<EntityAttributes, "id">;
    relationships?: Record<string, unknown>;
  }>;
  included?: Array<{
    id: string;
    type: string;
    attributes: Record<string, unknown>;
  }>;
  links?: Partial<{
    first: string;
    last: string;
    prev: string;
    next: string;
  } & Record<string, string>>;
  meta?: Record<string, unknown>;
};
