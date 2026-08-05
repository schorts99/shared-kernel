# 🧬 Rule: Domain-Driven Design (DDD) Modeling Standards

This rule specifies conventions, guidelines, and constraints for domain modeling within `@schorts/shared-kernel`.

---

## 1. Value Objects (`src/value-objects`)

Value Objects represent immutable concepts in the domain distinguished solely by their attributes, not an identity.

### Guidelines & Invariants:
1. **Inheritance & Contracts**: Extend `BaseValueObject<T>` or implement `ValueObject<T>`.
2. **Required Properties**:
   - `abstract readonly valueType: string`: A unique type discriminator string (e.g. `"UUID"`, `"Email"`, `"Coordinates"`).
   - `abstract readonly attributeName: string`: The domain property name associated with this value object.
   - `readonly value: T`: The underlying primitive or structure.
   - `abstract get isValid(): boolean`: Expression validating the input according to domain constraints.
3. **Immutability**:
   - The constructor must set internal state, and no mutator methods (`setX`) are permitted.
   - For complex composite value objects (e.g. `CoordinatesValue`, `ObjectValue`), return new instances when applying transformations.
4. **Equality (`equals`)**:
   - Custom equality must evaluate `other instanceof BaseValueObject`, matching `valueType`, validity check (`this.isValid && other.isValid`), and deep/primitive comparison of values.
5. **Serialization**:
   - Implement `toString(): string` and `toJSON(): T` returning sanitized primitives.

---

## 2. Entities (`src/entities`)

Entities represent domain concepts defined by a unique identity that endures over time and state changes.

### Guidelines & Invariants:
1. **Class Declaration**: Extend `Entity<IDValue extends ValueObject, M extends Model>`.
2. **Identity**:
   - Identity must be enforced via an explicit `IDValue` parameter in the constructor (`readonly id: IDValue`).
   - Equality check (`equals(other: unknown)`) MUST delegate directly to `this.id.equals(other.id)`.
3. **Domain Event Recording**:
   - Entities can record internal domain events using `this.recordDomainEvent(event)`.
   - Access domain events using `pullDomainEvents()` which returns and clears recorded events defensively.
4. **Primitives & Reconstruction**:
   - Abstract method `toPrimitives(): M` converts entity state into a plain serializable `Model`.
   - Static factory method `fromPrimitives(model: M)` reinstantiates the entity from raw primitive data.

---

## 3. Aggregate Roots (`src/aggregates`)

Aggregate Roots are clusters of domain entities and value objects treated as a single consistency unit.

### Guidelines & Invariants:
1. **Class Declaration**: Extend `AggregateRoot<IDValue extends ValueObject>`.
2. **Version & Event Sequencing**:
   - Maintain internal `_version: number` (defaults to `0`).
   - Increment version automatically when calling `recordDomainEvent(domainEvent)`.
   - Calling `pullDomainEvents()` attaches `sequenceNumber` to each pulled event and clears internal event array.
3. **Change Tracking**:
   - Track uncommitted changes with `hasUncommittedChanges`.
   - Clear uncommitted flags via `markChangesCommitted()`.
4. **Snapshots & Primitive Hydration**:
   - `toPrimitives()` converts aggregate to raw state object.
   - `toSnapshot()` outputs `{ id, version, data }`.
   - `fromPrimitives` and `fromSnapshot` use static factory constructors and optional `restoreFromPrimitives` lifecycle hooks to hydrate instances safely without re-triggering business rules or side-effects.

---

## 4. Domain Events (`src/domain-events`)

Domain Events represent immutable facts that have occurred in the business domain.

### Guidelines & Invariants:
1. **Class Declaration**: Extend `DomainEvent<T>`.
2. **Metadata Contract**:
   - Must contain metadata: `id`, `occurredAt`, `correlationId`, `causationId`, `version`, `userId`, `tenantId`, `retries`, `headers`, `context`.
   - `getEventName()` must return a dot-notation event identifier string (e.g., `user.created.v1`, `order.fulfilled`).
3. **Serialization**:
   - `toPrimitives()` formats metadata and payload into snake_case primitives suitable for transport across message brokers or event buses.
