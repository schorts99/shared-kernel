# 💾 Rule: Persistence & Data Access Standards

This rule specifies persistence abstractions, Unit of Work transactional controls, and Criteria query builders in `@schorts/shared-kernel`.

---

## 1. Data Access Objects (DAO) (`src/dao`)

Interfaces decoupling business logic from underlying database engines.

### Standards:
1. **DAO Interface**:
   - Defines standard CRUD methods: `save(entity)`, `findById(id)`, `findAll(criteria?)`, `delete(id, mode?)`.
   - `DeleteMode`: Soft delete (`DeleteMode.SOFT`) or Hard delete (`DeleteMode.HARD`). Default soft/hard policy must be specified per implementation.
2. **InMemoryDAO**:
   - Generic in-memory implementation useful for testing and rapid prototyping.
   - Preserves state in a private `Map<string, Entity>` collection.

---

## 2. Unit of Work Pattern (`src/unit-of-work`)

Transactional coordination across multiple DAO operations.

### Standards:
1. **UnitOfWork Interface**:
   - Exposes `registerNew(entity)`, `registerDirty(entity)`, `registerClean(entity)`, `registerDeleted(entity)`, `commit()`, `rollback()`.
2. **UnitOfWorkRunner**:
   - Executes an async operation block wrapped inside a transactional Unit of Work context.
   - Automatically executes `commit()` on success, or `rollback()` if any error is raised.

---

## 3. Criteria Query Builder (`src/criteria`)

Fluent query specification abstraction for filtering, sorting, and pagination.

### Standards:
1. **Criteria Class**:
   - Holds arrays of `Filter`, `Order`, and pagination options (`offset`, `limit`).
   - Fluent interface methods: `.where(field, operator, value)`, `.orderBy(field, direction)`, `.offsetResults(offset)`, `.limitResults(limit)`.
2. **Filter & Operator**:
   - `Filter`: Encapsulates `field`, `operator` (`Operator`), and `value`.
   - `Operator`: Supported operators include `EQUAL`, `NOT_EQUAL`, `GT`, `GTE`, `LT`, `LTE`, `CONTAINS`, `IN`.
3. **Order & Direction**:
   - `Order`: Specifies sorting by `field` and `direction` (`ASC` or `DESC`).
