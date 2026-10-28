export type JSONAPISingle<EntityAttributes> = {
  data: {
    id: string;
    type: string;
    attributes: Omit<EntityAttributes, "id">;
    relationships?: Record<string, unknown>;
  };
  included?: Array<{
    id: string;
    type: string;
    attributes: Record<string, unknown>;
  }>;
  meta?: Record<string, unknown>;
};
