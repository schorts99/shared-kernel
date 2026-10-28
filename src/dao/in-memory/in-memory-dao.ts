import { Model } from "../../models";
import { Entity as BaseEntity } from "../../entities";
import { Criteria, Operator } from "../../criteria";
import { UnitOfWork } from "../../unit-of-work";
import { ValueObject } from "../../value-objects";
import { cloneValue } from "../../utils/object";
import { DeleteMode } from "../delete-mode";
import { DAO } from "../dao";

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

    const cloned = this.clone(entity);
    state.entities.set(id, cloned);

    return this.clone(cloned);
  }

  async save(entity: Entity, uow?: UnitOfWork): Promise<Entity> {
    const state = this.getState(uow);
    const id = entity.id.value as M["id"];
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

  private evaluateFilter(value: any, operator: Operator, filterValue: any): boolean {
    switch (operator) {
      case "EQUAL":
        return value === filterValue;
      case "NOT_EQUAL":
        return value !== filterValue;
      case "GREATER_THAN":
        return value > filterValue;
      case "LESS_THAN":
        return value < filterValue;
      case "GREATER_THAN_OR_EQUAL":
        return value >= filterValue;
      case "LESS_THAN_OR_EQUAL":
        return value <= filterValue;
      case "IN":
        return Array.isArray(filterValue) && filterValue.includes(value);
      case "NOT_IN":
        return Array.isArray(filterValue) && !filterValue.includes(value);
      case "LIKE":
        return (
          typeof value === "string" &&
          typeof filterValue === "string" &&
          value.toLowerCase().includes(filterValue.toLowerCase().replace(/%/g, ""))
        );
      case "BETWEEN": {
        if (value === null || value === undefined) {
          return false;
        }
        if (Array.isArray(filterValue) && filterValue.length === 2) {
          return value >= filterValue[0] && value <= filterValue[1];
        }
        if (filterValue && typeof filterValue === "object") {
          const min = filterValue.min ?? filterValue.from;
          const max = filterValue.max ?? filterValue.to;
          if (min !== undefined && max !== undefined) {
            return value >= min && value <= max;
          }
        }
        return false;
      }
      case "ARRAY_CONTAINS":
        return Array.isArray(value) && value.includes(filterValue);
      case "ARRAY_CONTAINS_ANY":
        return (
          Array.isArray(value) &&
          Array.isArray(filterValue) &&
          filterValue.some(candidate => value.includes(candidate))
        );
      case "GEO_RADIUS":
        return this.evaluateGeoRadius(value, filterValue);
      default: {
        const exhaustiveCheck: never = operator;
        throw new Error(`Unsupported operator: ${String(exhaustiveCheck)}`);
      }
    }
  }

  private evaluateGeoRadius(value: any, filterValue: any): boolean {
    const point = this.extractCoordinates(value);
    if (!point || !filterValue || typeof filterValue !== "object") {
      return false;
    }

    const center = this.extractCoordinates(filterValue.center ?? filterValue);
    const radiusMeters =
      typeof filterValue.radiusInM === "number"
        ? filterValue.radiusInM
        : typeof filterValue.radius === "number"
          ? filterValue.radius
          : typeof filterValue.radiusInKm === "number"
            ? filterValue.radiusInKm * 1_000
            : undefined;

    if (!center || radiusMeters === undefined || !Number.isFinite(radiusMeters) || radiusMeters < 0) {
      return false;
    }

    const distanceMeters = this.calculateHaversineMeters(point, center);
    return distanceMeters <= radiusMeters;
  }

  private extractCoordinates(raw: any): { lat: number; lng: number } | null {
    if (!raw) {
      return null;
    }
    if (Array.isArray(raw) && raw.length >= 2) {
      const lat = Number(raw[0]);
      const lng = Number(raw[1]);
      return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
    }
    if (typeof raw === "object") {
      const lat = Number(raw.lat ?? raw.latitude);
      const lng = Number(raw.lng ?? raw.lon ?? raw.longitude);
      return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
    }
    return null;
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
      for (const order of criteria.orders) {
        const valA = this.getNestedValue(a.toPrimitives() as any, order.field);
        const valB = this.getNestedValue(b.toPrimitives() as any, order.field);

        if (valA < valB) return order.direction === "ASC" ? -1 : 1;
        if (valA > valB) return order.direction === "ASC" ? 1 : -1;
      }

      return 0;
    });

    return sorted;
  }
}
