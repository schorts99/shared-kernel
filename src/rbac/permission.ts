export type BaseAction = "read" | "write" | "delete" | "manage" | "create" | "update" | "*";

export interface Permission<Action extends string = string> {
  resource: string;
  action: Action | BaseAction;
}

export function createPermission<Action extends string = BaseAction>(
  resource: string,
  action: Action | BaseAction
): Permission<Action> {
  return { resource, action };
}
