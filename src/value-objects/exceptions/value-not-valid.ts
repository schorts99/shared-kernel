export interface ValueNotValid extends Error {
  readonly attributeName: string;
}
