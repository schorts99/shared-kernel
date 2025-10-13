import { TranslationResolver } from "../../i18n";

export class DomainEventNotRegistered extends Error {
  constructor(domainEventName: string, translationResolver?: TranslationResolver) {
    const message = translationResolver
      ? translationResolver.resolve("domain_events.errors.domain_event_not_registered")
      : `DomainEvent Not Registered: ${domainEventName}`;

    super(message);
  }
}
