export class JSONAPIErrors extends Error {
  readonly errors: Array<{
    id?: string;
    status: string;
    code: string;
    title: string;
    detail: string;
    source?: { pointer: string } | { parameter: string } | { header: string };
    meta?: Record<string, any>;
  }>;

  constructor(errors: JSONAPIErrors["errors"], message?: string) {
    const formatted = errors
      .map(err => {
        if (err.title && err.detail) return `${err.title}: ${err.detail}`;
        return err.detail || err.title || err.code || err.status;
      })
      .filter(Boolean)
      .join("; ");
    super(message ?? (formatted || "JSON:API Errors"));

    this.name = "JSONAPIErrors";
    this.errors = errors;
  }
}
