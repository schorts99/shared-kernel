export type JSONAPISingle<EntityAttributes> = {
    data: {
        id: string;
        type: string;
        attributes: Omit<EntityAttributes, "id">;
    };
    included?: Array<{
        id: string;
        type: string;
        attributes: Record<string, any>;
    }>;
    meta?: Record<string, any>;
};
//# sourceMappingURL=json-api-single.d.ts.map