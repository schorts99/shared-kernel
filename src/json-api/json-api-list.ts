export type JSONAPIList<EntityAttributes> = {
  data: Array<{
    id: string;
    type: string;
    attributes: Omit<EntityAttributes, "id">;
  }>;
  included?: Array<{
    id: string;
    type: string;
    attributes: Record<string, any>;
  }>;
  meta?: Record<string, any>;
};
