export class ValuesNotValid extends Error {
  readonly errors: Array<Error>;

  constructor(errors: Array<Error>) {
    super();

    this.errors = errors;
  }
}
