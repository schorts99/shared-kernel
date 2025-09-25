export interface Message<Primitives = {}> {
  toPrimitives(): Primitives;
}
