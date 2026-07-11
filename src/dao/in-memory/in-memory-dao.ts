import { Model } from "../../models";
import { Entity as BaseEntity } from "../../entities";
import { Criteria } from "../../criteria";
import { UnitOfWork } from "../../unit-of-work";
import { ValueObject } from "../../value-objects";
import { DeleteMode } from "../delete-mode";
import { DAO } from "../dao";

export class InMemoryDAO<
  M extends Model,
  Entity extends BaseEntity<ValueObject, M>,
> extends DAO<Model, Entity> {
  protected readonly entities: Map<M["id"], Entity>;

  constructor(
    deleteMode: DeleteMode = "HARD",
    initialData?: Map<M["id"], Entity>,
  ) {
    super(deleteMode);

    this.entities = initialData || new Map();
  }

  async getAll(uow?: UnitOfWork): Promise<Entity[]> {
    const all = Array.from(this.entities.values());

    return this.filterSoftDeleted(all);
  }

  async findByID(id: M["id"], uow?: UnitOfWork): Promise<Entity | null> {
    const entity = this.entities.get(id);

    if (!entity) return null;

    return this.isSoftDeleted(entity) ? null : entity;
  }

  async findOneBy(criteria: Criteria, uow?: UnitOfWork): Promise<Entity | null> {
    const results = await this.search(criteria, uow);

    return results.length > 0 ? results[0]! : null;
  }

  async search(criteria: Criteria, uow?: UnitOfWork): Promise<Entity[]> {
    let results = Array.from(this.entities.values());
    results = this.filterSoftDeleted(results);

    if (criteria.hasFilters()) {
      results = results.filter((entity) => this.matchesCriteria(entity, criteria));
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

    return results;
  }

  async count(uow?: UnitOfWork): Promise<number> {
    return this.filterSoftDeleted(Array.from(this.entities.values())).length;
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
    const id = entity.id.value as M["id"];

    if (this.entities.has(id)) {
      throw new Error(`Entity with id ${id} already exists`);
    }

    this.entities.set(id, entity);

    return entity;
  }

  async update(entity: Entity, uow?: UnitOfWork): Promise<Entity> {
    const id = entity.id.value as M["id"];

    if (!this.entities.has(id)) {
      throw new Error(`Entity with id ${id} not found`);
    }

    this.entities.set(id, entity);

    return entity;
  }

  async save(entity: Entity, uow?: UnitOfWork): Promise<Entity> {
    const id = entity.id.value as M["id"];

    this.entities.set(id, entity);

    return entity;
  }

  async delete(entity: Entity, uow?: UnitOfWork): Promise<Entity> {
    const id = entity.id.value as M["id"];

    if (this.deleteMode === "SOFT") {
      console.warn("Soft delete not fully implemented in basic InMemoryDAO");
      this.entities.delete(id);
    } else {
      this.entities.delete(id);
    }

    return entity;
  }

  async deleteByID(id: M["id"], uow?: UnitOfWork): Promise<void> {
    const entity = this.entities.get(id);

    if (entity) {
      await this.delete(entity, uow);
    }
  }

  async saveMany(entities: Entity[], uow?: UnitOfWork): Promise<Entity[]> {
    for (const entity of entities) {
      await this.save(entity, uow);
    }

    return entities;
  }

  async restore(entity: Entity, uow?: UnitOfWork): Promise<Entity> {
    const id = entity.id.value as M["id"];

    if (this.entities.has(id)) {
      this.entities.set(id, entity);
    }

    return entity;
  }

  private filterSoftDeleted(entities: Entity[]): Entity[] {
    if (this.deleteMode === "HARD") return entities;

    return entities.filter((e) => !this.isSoftDeleted(e));
  }

  private isSoftDeleted(entity: Entity): boolean {
    const M = entity.toPrimitives() as any;

    return M.deletedAt != null;
  }

  private matchesCriteria(entity: Entity, criteria: Criteria): boolean {
    const M = entity.toPrimitives() as any;

    return criteria.filters.every((filter) => {
      const value = this.getNestedValue(M, filter.field);

      return this.evaluateFilter(value, filter.operator, filter.value);
    });
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split(".").reduce((o, key) => o?.[key], obj);
  }

  private evaluateFilter(value: any, operator: any, filterValue: any): boolean {
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
        return typeof value === "string" && typeof filterValue === "string" &&
          value.toLowerCase().includes(filterValue.toLowerCase().replace(/%/g, ""));
      default:
        console.warn(`Unsupported operator: ${operator}`);

        return false;
    }
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
