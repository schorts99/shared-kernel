import { LimitNotValid, OffsetNotValid } from "../criteria";

export type PaginationLinks = {
  self: string;
  first: string;
  prev: string | null;
  next: string | null;
  last: string;
};

export class PaginationLinksGenerator {
  constructor(private readonly url: URL) {}

  generate(offset: number, limit: number, total: number): PaginationLinks {
    if (!Number.isSafeInteger(limit) || limit <= 0) throw new LimitNotValid(limit);
    if (!Number.isSafeInteger(offset) || offset < 0) throw new OffsetNotValid(offset);

    const safeTotal = Math.max(0, total);
    const totalPages = Math.ceil(safeTotal / limit);
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
    const baseHref = `${this.url.origin}${this.url.pathname}`;
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

    return `${baseHref}?${query}${this.url.hash}`;
  }
}

