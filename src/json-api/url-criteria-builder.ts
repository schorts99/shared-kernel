import { URLWithParamsBuilder } from "../utils";
import { Criteria } from "../criteria";

export class URLCriteriaBuilder {
  constructor(
    private readonly base: URL,
    private readonly criteria?: Criteria,
    private readonly include?: string[]
  ) {}

  build(): URL {
    const builder = new URLWithParamsBuilder(new URL(this.base.href));

    if (this.include?.length) {
      builder.with({ include: this.include });
    }

    if (this.criteria) {
      Object.entries(this.criteria.filters).forEach(([field, { operator, value }]) => {
        const encodedField = field.replace(/\./g, "."); // allows nested filters like roles.name

        if (operator === "EQUAL") {
          builder.with({ [`filter[${encodedField}]`]: value });
        } else if (operator === "IN" && Array.isArray(value)) {
          builder.with({ [`filter[${encodedField}]`]: value.join(",") });
        } else {
          builder.with({ [`filter[${encodedField}][${operator}]`]: value });
        }
      });

      if (this.criteria.orders.length > 0) {
        const sortParam = this.criteria.orders
          .map(({ field, direction }) => (direction === "DESC" ? `-${field}` : field))
          .join(",");
        builder.with({ sort: sortParam });
      }

      if (this.criteria.limit !== undefined) {
        builder.with({ "page[limit]": this.criteria.limit });
      }

      if (this.criteria.offset !== undefined) {
        builder.with({ "page[offset]": this.criteria.offset });
      }
    }

    return builder.build();
  }
}
