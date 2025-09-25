export type QueryOptions = Partial<{
  include: string[];
  filter: Record<string, string | number | boolean | Array<string | number>>;
  sort: string | string[];
  page: Partial<{ offset: number; limit: number }>;
}>;
