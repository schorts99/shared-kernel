export type JSONAPISingle<EntityAttributes> = {
  data: {
    id: string;
    type: string;
    attributes: Omit<EntityAttributes, "id">;
    relationships?: Record<string, any>;
  };
  included?: Array<{
    id: string;
    type: string;
    attributes: Record<string, any>;
  }>;
  meta?: Record<string, any>;
};
