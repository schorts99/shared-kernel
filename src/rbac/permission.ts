type BaseAction = "read" | "write" | "delete" | "manage";

export type Permission<Action extends string = BaseAction> = {
  resource: string;
  action: Action;
}
