import { CommandBusMiddleware, CommandBusContext } from "./command-bus";
import { Command } from "./command";
import { Cache } from "./cache";

export interface CacheInvalidationEvent {
  getInvalidationTags(): string[];
}

export class CacheInvalidationMiddleware implements CommandBusMiddleware<true> {
  constructor(private readonly cache: Cache) {}

  async onEvents<C extends Command>(
    command: C,
    events: any[],
    context: CommandBusContext
  ): Promise<void> {
    if (!this.cache.deleteByTags) return;

    const tagsToInvalidate = new Set<string>();

    for (const event of events) {
      if (typeof event.getInvalidationTags === "function") {
        const tags = event.getInvalidationTags();
        if (Array.isArray(tags)) {
          for (const tag of tags) {
            tagsToInvalidate.add(tag);
          }
        }
      }
    }

    if (tagsToInvalidate.size > 0) {
      await this.cache.deleteByTags(Array.from(tagsToInvalidate));
    }
  }
}
