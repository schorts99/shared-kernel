import { Model } from "../../models/index.js";
import { Entity as BaseEntity } from "../../entities/index.js";
import { Criteria, Operator, readBetweenBounds, readGeoPoint, readGeoRadius } from "../../criteria/index.js";
import { UnitOfWork } from "../../unit-of-work/index.js";
import { ValueObject } from "../../value-objects/index.js";
import { cloneValue } from "../../utils/object.js";
import { DeleteMode } from "../delete-mode.js";
import { DAO } from "../dao.js";

export interface InMemoryDAOOptions<Entity> {
  cloneEntity?: (entity: Entity) => Entity;
}

interface DAOState<ID, Entity> {
  entities: Map<ID, Entity>;
  softDeletedAt: Map<ID, string>;
}

interface HookableUnitOfWork extends UnitOfWork {
  onCommit?: (hook: () => void | Promise<void>) => void;
  onRollback?: (hook: () => void | Promise<void>) => void;
}

export class InMemoryDAO<
  M extends Model,
  Entity extends BaseEntity<ValueObject, M>,
> extends DAO<M, Entity> {
  protected readonly entities: Map<M["id"], Entity>;
  protected readonly softDeletedAt = new Map<M["id"], string>();
  private readonly txStates = new WeakMap<UnitOfWork, DAOState<M["id"], Entity>>();
  private readonly clone: (entity: Entity) => Entity;

  constructor(
    deleteMode: DeleteMode = "HARD",
    initialData?: Map<M["id"], Entity>,
    options: InMemoryDAOOptions<Entity> = {},
  ) {
    super(deleteMode);
    this.clone = options.cloneEntity ?? (entity => cloneValue(entity));
    this.entities = new Map();

    if (initialData) {
      for (const [id, entity] of initialData.entries()) {
        const cloned = this.clone(entity);
        this.entities.set(id, cloned);
        const primitives = cloned.toPrimitives() as Record<string, any>;
        if (primitives?.deletedAt != null) {
          this.softDeletedAt.set(id, String(primitives.deletedAt));
        }
      }
    }
  }

  private getState(uow?: UnitOfWork): DAOState<M["id"], Entity> {
    if (!uow) {
      return {
        entities: this.entities,
        softDeletedAt: this.softDeletedAt,
      };
    }

    let txState = this.txStates.get(uow);
    if (txState) {
      return txState;
    }

    const snapshotEntities = new Map<M["id"], Entity>();
    for (const [id, entity] of this.entities.entries()) {
      snapshotEntities.set(id, this.clone(entity));
    }
    const snapshotSoftDeleted = new Map<M["id"], string>(this.softDeletedAt);

    txState = {
      entities: snapshotEntities,
      softDeletedAt: snapshotSoftDeleted,
    };
    this.txStates.set(uow, txState);

    const applyCommit = () => {
      const committedState = this.txStates.get(uow);
      if (!committedState) {
        return;
      }
      this.entities.clear();
      for (const [id, entity] of committedState.entities.entries()) {
        this.entities.set(id, this.clone(entity));
      }
      this.softDeletedAt.clear();
      for (const [id, deletedAt] of committedState.softDeletedAt.entries()) {
        this.softDeletedAt.set(id, deletedAt);
      }
      this.txStates.delete(uow);
    };

    const applyRollback = () => {
      this.txStates.delete(uow);
    };

    const hookable = uow as HookableUnitOfWork;
    if (typeof hookable.onCommit === "function" && typeof hookable.onRollback === "function") {
      hookable.onCommit(applyCommit);
      hookable.onRollback(applyRollback);
    } else {
      const originalCommit = uow.commit.bind(uow);
      const originalRollback = uow.rollback.bind(uow);
      uow.commit = async () => {
        await originalCommit();
        applyCommit();
      };
      uow.rollback = async () => {
        try {
          await originalRollback();
        } finally {
          applyRollback();
        }
      };
    }

    return txState;
  }

  async getAll(uow?: UnitOfWork): Promise<Entity[]> {
    const state = this.getState(uow);
    const all = Array.from(state.entities.values());

    return this.filterSoftDeleted(all, state).map(entity => this.clone(entity));
  }

  async findByID(id: M["id"], uow?: UnitOfWork): Promise<Entity | null> {
    const state = this.getState(uow);
    const entity = state.entities.get(id);

    if (!entity) return null;

    return this.isSoftDeleted(entity, state) ? null : this.clone(entity);
  }

  async findOneBy(criteria: Criteria, uow?: UnitOfWork): Promise<Entity | null> {
    const results = await this.search(criteria, uow);

    return results.length > 0 ? results[0]! : null;
  }

  async search(criteria: Criteria, uow?: UnitOfWork): Promise<Entity[]> {
    const state = this.getState(uow);
    let results = Array.from(state.entities.values());
    results = this.filterSoftDeleted(results, state);

    if (criteria.hasFilters()) {
      results = results.filter(entity => this.matchesCriteria(entity, criteria));
    }

    if (criteria.hasOrders()) {
      results = this.applyOrdering(results, criteria);
    }

    if (criteria.offset) {
      results = results.slice(criteria.offset);
    }

    if (criteria.limit) {
      results = results.slice(0, criteria.limit);
    }

    return results.map(entity => this.clone(entity));
  }

  async count(uow?: UnitOfWork): Promise<number> {
    const state = this.getState(uow);
    return this.filterSoftDeleted(Array.from(state.entities.values()), state).length;
  }

  async countBy(criteria: Criteria, uow?: UnitOfWork): Promise<number> {
    const results = await this.search(criteria, uow);

    return results.length;
  }

  async exists(criteria: Criteria, uow?: UnitOfWork): Promise<boolean> {
    const result = await this.findOneBy(criteria, uow);

    return result !== null;
  }

  async create(entity: Entity, uow?: UnitOfWork): Promise<Entity> {
    const state = this.getState(uow);
    const id = entity.id.value as M["id"];

    if (state.entities.has(id) && !this.isSoftDeleted(state.entities.get(id)!, state)) {
      throw new Error(`Entity with id ${id} already exists`);
    }

    uow?.collectEventsFrom?.(entity);
    const cloned = this.clone(entity);
    state.entities.set(id, cloned);
    const primitives = cloned.toPrimitives() as Record<string, any>;
    if (primitives?.deletedAt != null) {
      state.softDeletedAt.set(id, String(primitives.deletedAt));
    } else {
      state.softDeletedAt.delete(id);
    }

    return this.clone(cloned);
  }

  async update(entity: Entity, uow?: UnitOfWork): Promise<Entity> {
    const state = this.getState(uow);
    const id = entity.id.value as M["id"];
    const existing = state.entities.get(id);

    if (!existing || this.isSoftDeleted(existing, state)) {
      throw new Error(`Entity with id ${id} not found`);
    }

    uow?.collectEventsFrom?.(entity);
    const cloned = this.clone(entity);
    state.entities.set(id, cloned);

    return this.clone(cloned);
  }

  async save(entity: Entity, uow?: UnitOfWork): Promise<Entity> {
    const state = this.getState(uow);
    const id = entity.id.value as M["id"];

    uow?.collectEventsFrom?.(entity);
    const cloned = this.clone(entity);

    state.entities.set(id, cloned);
    const primitives = cloned.toPrimitives() as Record<string, any>;
    if (primitives?.deletedAt != null) {
      state.softDeletedAt.set(id, String(primitives.deletedAt));
    } else {
      state.softDeletedAt.delete(id);
    }

    return this.clone(cloned);
  }

  async delete(entity: Entity, uow?: UnitOfWork): Promise<Entity> {
    const state = this.getState(uow);
    const id = entity.id.value as M["id"];
    const stored = state.entities.get(id) ?? entity;
    const cloned = this.clone(stored);

    if (this.deleteMode === "SOFT") {
      const deletedAt = new Date().toISOString();
      state.softDeletedAt.set(id, deletedAt);
      if ("deletedAt" in (cloned as Record<string, any>)) {
        (cloned as Record<string, any>).deletedAt = deletedAt;
      }
      state.entities.set(id, cloned);
    } else {
      state.entities.delete(id);
      state.softDeletedAt.delete(id);
    }

    return this.clone(cloned);
  }

  async deleteByID(id: M["id"], uow?: UnitOfWork): Promise<void> {
    const state = this.getState(uow);
    const entity = state.entities.get(id);

    if (entity) {
      await this.delete(entity, uow);
    }
  }

  async saveMany(entities: Entity[], uow?: UnitOfWork): Promise<Entity[]> {
    const saved: Entity[] = [];
    for (const entity of entities) {
      saved.push(await this.save(entity, uow));
    }

    return saved;
  }

  async restore(entity: Entity, uow?: UnitOfWork): Promise<Entity> {
    const state = this.getState(uow);
    const id = entity.id.value as M["id"];
    const cloned = this.clone(entity);

    if ("deletedAt" in (cloned as Record<string, any>)) {
      (cloned as Record<string, any>).deletedAt = null;
    }

    state.softDeletedAt.delete(id);
    state.entities.set(id, cloned);

    return this.clone(cloned);
  }

  private filterSoftDeleted(entities: Entity[], state: DAOState<M["id"], Entity>): Entity[] {
    if (this.deleteMode === "HARD") return entities;

    return entities.filter(e => !this.isSoftDeleted(e, state));
  }

  private isSoftDeleted(entity: Entity, state: DAOState<M["id"], Entity>): boolean {
    if (this.deleteMode === "HARD") {
      return false;
    }
    const id = entity.id.value as M["id"];
    if (state.softDeletedAt.has(id)) {
      return true;
    }
    const primitives = entity.toPrimitives() as Record<string, any>;

    return primitives?.deletedAt != null;
  }

  private matchesCriteria(entity: Entity, criteria: Criteria): boolean {
    const primitives = entity.toPrimitives() as Record<string, any>;

    return criteria.filters.every(filter => {
      const value = this.getNestedValue(primitives, filter.field);

      return this.evaluateFilter(value, filter.operator, filter.value);
    });
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split(".").reduce((o, key) => o?.[key], obj);
  }

  private toTimestampIfDateLike(val: unknown): number | null {
    if (val instanceof Date) {
      const ms = val.getTime();
      return Number.isNaN(ms) ? null : ms;
    }
    if (
      typeof val === "string" &&
      /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})?)?$/.test(val)
    ) {
      const ms = Date.parse(val);
      return Number.isNaN(ms) ? null : ms;
    }
    return null;
  }

  private valuesEqual(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    const tsA = this.toTimestampIfDateLike(a);
    const tsB = this.toTimestampIfDateLike(b);
    if (tsA !== null && tsB !== null) {
      return tsA === tsB;
    }
    return false;
  }

  private compareValues(a: unknown, b: unknown): number | null {
    if (a === null || a === undefined || b === null || b === undefined) {
      return null;
    }
    const tsA = this.toTimestampIfDateLike(a);
    const tsB = this.toTimestampIfDateLike(b);
    if (tsA !== null && tsB !== null) {
      return tsA < tsB ? -1 : tsA > tsB ? 1 : 0;
    }
    if (
      typeof a === typeof b &&
      (typeof a === "number" ||
        typeof a === "string" ||
        typeof a === "boolean" ||
        typeof a === "bigint")
    ) {
      if (typeof a === "number" && (Number.isNaN(a) || Number.isNaN(b as number))) {
        return null;
      }
      return (a as any) < (b as any) ? -1 : (a as any) > (b as any) ? 1 : 0;
    }
    return null;
  }

  private evaluateFilter(value: unknown, operator: Operator, filterValue: unknown): boolean {
    switch (operator) {
      case "EQUAL":
        return this.valuesEqual(value, filterValue);
      case "NOT_EQUAL":
        return !this.valuesEqual(value, filterValue);
      case "GREATER_THAN": {
        const cmp = this.compareValues(value, filterValue);
        return cmp !== null && cmp > 0;
      }
      case "LESS_THAN": {
        const cmp = this.compareValues(value, filterValue);
        return cmp !== null && cmp < 0;
      }
      case "GREATER_THAN_OR_EQUAL": {
        const cmp = this.compareValues(value, filterValue);
        return cmp !== null && cmp >= 0;
      }
      case "LESS_THAN_OR_EQUAL": {
        const cmp = this.compareValues(value, filterValue);
        return cmp !== null && cmp <= 0;
      }
      case "IN":
        return (
          Array.isArray(filterValue) &&
          filterValue.some(candidate => this.valuesEqual(value, candidate))
        );
      case "NOT_IN":
        return (
          Array.isArray(filterValue) &&
          !filterValue.some(candidate => this.valuesEqual(value, candidate))
        );
      case "LIKE": {
        if (typeof value !== "string" || typeof filterValue !== "string") {
          return false;
        }
        if (!filterValue.includes("%") && !filterValue.includes("_")) {
          return value.toLowerCase().includes(filterValue.toLowerCase());
        }
        const regexSource = filterValue
          .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
          .replace(/%/g, "[\\s\\S]*")
          .replace(/_/g, "[\\s\\S]");
        return new RegExp(`^${regexSource}$`, "i").test(value);
      }
      case "BETWEEN": {
        const bounds = readBetweenBounds(filterValue);
        if (value === null || value === undefined || !bounds) {
          return false;
        }
        const cmpMin = this.compareValues(value, bounds[0]);
        const cmpMax = this.compareValues(value, bounds[1]);
        return cmpMin !== null && cmpMax !== null && cmpMin >= 0 && cmpMax <= 0;
      }
      case "ARRAY_CONTAINS":
        return Array.isArray(value) && value.some(item => this.valuesEqual(item, filterValue));
      case "ARRAY_CONTAINS_ANY":
        return (
          Array.isArray(value) &&
          Array.isArray(filterValue) &&
          filterValue.some(candidate => value.some(item => this.valuesEqual(item, candidate)))
        );
      case "GEO_RADIUS":
        return this.evaluateGeoRadius(value, filterValue);
      default: {
        const exhaustiveCheck: never = operator;
        throw new Error(`Unsupported operator: ${String(exhaustiveCheck)}`);
      }
    }
  }

  private evaluateGeoRadius(value: unknown, filterValue: unknown): boolean {
    const point = readGeoPoint(value);
    const geo = readGeoRadius(filterValue);
    if (!point || !geo) {
      return false;
    }

    return this.calculateHaversineMeters(point, geo) <= geo.radiusInM;
  }

  private calculateHaversineMeters(
    a: { lat: number; lng: number },
    b: { lat: number; lng: number },
  ): number {
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const earthRadiusMeters = 6_371_000;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const sinLat = Math.sin(dLat / 2);
    const sinLng = Math.sin(dLng / 2);
    const h =
      sinLat * sinLat +
      Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng;
    const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
    return earthRadiusMeters * c;
  }

  private applyOrdering(entities: Entity[], criteria: Criteria): Entity[] {
    const sorted = [...entities];

    sorted.sort((a, b) => {
      const primA = a.toPrimitives() as any;
      const primB = b.toPrimitives() as any;
      for (const order of criteria.orders) {
        const valA = this.getNestedValue(primA, order.field);
        const valB = this.getNestedValue(primB, order.field);

        const aNull = valA === null || valA === undefined;
        const bNull = valB === null || valB === undefined;
        if (aNull && bNull) continue;
        if (aNull) return 1;
        if (bNull) return -1;

        const cmp = this.compareValues(valA, valB);
        if (cmp !== null && cmp !== 0) {
          return order.direction === "ASC" ? cmp : -cmp;
        }
      }

      return 0;
    });

    return sorted;
  }
}
