export const SharedKernelTranslationKeys = {
  auth: {
    errors: {
      NotAuthenticated: "auth.errors.not_authenticated",
      RequireAuthNotImplementedCorrectly: "auth.errors.require_auth_not_implemented_correctly",
    },
  },
  cqrs: {
    errors: {
      CommandNotRegistered: "cqrs.errors.command_not_registered",
      QueryNotRegistered: "cqrs.errors.query_not_registered",
      CommandHandlerNotRegistered: "cqrs.errors.command_handler_not_registered",
      QueryHandlerNotRegistered: "cqrs.errors.query_handler_not_registered",
    },
  },
  criteria: {
    errors: {
      LimitNotValid: "criteria.errors.limit_not_valid",
      OffsetNotValid: "criteria.errors.offset_not_valid",
    },
  },
  domainEvents: {
    errors: {
      DomainEventNotRegistered: "domain_events.errors.domain_event_not_registered",
    },
  },
  entities: {
    errors: {
      EntityNotRegistered: "entities.errors.entity_not_registered",
    },
  },
  rbac: {
    errors: {
      NotAuthorized: "rbac.errors.not_authorized",
    },
  },
};
