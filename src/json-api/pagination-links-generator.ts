import { LimitNotValid, OffsetNotValid } from "../criteria";

type PaginationLinks = {
	self: string;
	first: string;
	prev: string | null;
	next: string | null;
	last: string;
};

export class PaginationLinksGenerator {
  constructor(private readonly url: URL) {}

  generate(offset: number, limit: number, total: number): PaginationLinks {
    if (limit <= 0) throw new LimitNotValid(limit);
    if (offset < 0) throw new OffsetNotValid(offset);

    const totalPages = Math.ceil(total / limit);
    const currentPage = Math.floor(offset / limit) + 1;

    return {
      self: this.generateLink(offset, limit),
			first: this.generateLink(0, limit),
			prev: currentPage > 1 ? this.generateLink((currentPage - 2) * limit, limit) : null,
			next: currentPage < totalPages ? this.generateLink(currentPage * limit, limit) : null,
			last: this.generateLink(totalPages > 0 ? (totalPages - 1) * limit : 0, limit),
    };
  }

  private generateLink(offset: number, limit: number): string {
    const baseHref = this.url.href.split("?")[0]!;
    const existingSearch = this.url.search
      ? this.url.search
          .slice(1)
          .split("&")
          .filter(
            part =>
              part !== "" &&
              !part.startsWith("page[offset]=") &&
              !part.startsWith("page%5Boffset%5D=") &&
              !part.startsWith("page[limit]=") &&
              !part.startsWith("page%5Blimit%5D="),
          )
      : [];
    const paginationParams = [`page[offset]=${offset}`, `page[limit]=${limit}`];
    const query = [...existingSearch, ...paginationParams].join("&");

    return `${baseHref}?${query}`;
  }
}

