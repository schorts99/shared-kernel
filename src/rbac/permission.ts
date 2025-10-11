export type Permission = {
  resource: string;
  action: "read" | "write" | "delete" | "manage";
}
