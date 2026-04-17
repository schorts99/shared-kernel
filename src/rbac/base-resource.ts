export interface BaseResource {
  name: string;
}

export function asResource(name: string): BaseResource {
  return { name };
}
