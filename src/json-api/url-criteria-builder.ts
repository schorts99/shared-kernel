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
      builder.with({ include: this.include.join(",") });
    }

    if (this.criteria) {
      this.criteria.filters.forEach(({ field, operator, value }) => {
        const encodedField = field.replace(/\./g, ".");

        switch (operator) {
          case "EQUAL":
            builder.with({ [`filter[${encodedField}]`]: value });
            break;

          case "NOT_EQUAL":
            builder.with({ [`filter[${encodedField}][ne]`]: value });
            break;

          case "GREATER_THAN":
            builder.with({ [`filter[${encodedField}][gt]`]: value });
            break;

          case "LESS_THAN":
            builder.with({ [`filter[${encodedField}][lt]`]: value });
            break;

          case "GREATER_THAN_OR_EQUAL":
            builder.with({ [`filter[${encodedField}][gte]`]: value });
            break;

          case "LESS_THAN_OR_EQUAL":
            builder.with({ [`filter[${encodedField}][lte]`]: value });
            break;

          case "IN":
            if (Array.isArray(value)) {
              builder.with({ [`filter[${encodedField}][in]`]: value.join(",") });
            }
            break;

          case "NOT_IN":
            if (Array.isArray(value)) {
              builder.with({ [`filter[${encodedField}][nin]`]: value.join(",") });
            }
            break;

          case "LIKE":
            builder.with({ [`filter[${encodedField}][like]`]: value });
            break;

          case "BETWEEN":
            if (Array.isArray(value) && value.length === 2) {
              builder.with({
                [`filter[${encodedField}][between]`]: `${value[0]},${value[1]}`,
              });
            }
            break;

          case "GEO_RADIUS":
            if (value && typeof value === "object") {
              const { lat, lng, radius } = value;
              builder.with({
                [`filter[${encodedField}][geo_radius]`]: `${lat},${lng},${radius}`,
              });
            }
            break;

          default:
            throw new Error(`Unsupported operator: ${operator satisfies never}`);
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
