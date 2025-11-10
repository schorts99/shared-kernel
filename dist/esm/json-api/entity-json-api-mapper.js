"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EntityJSONAPIMapper = void 0;
class EntityJSONAPIMapper {
    static mapEntity(entity) {
        const attributes = entity.toPrimitives();
        delete attributes.id;
        return {
            data: {
                type: entity.type,
                id: entity.id.value,
                attributes: attributes,
            },
        };
    }
    static mapEntities(entities) {
        return { data: entities.map((e) => this.mapEntity(e).data) };
    }
}
exports.EntityJSONAPIMapper = EntityJSONAPIMapper;
//# sourceMappingURL=entity-json-api-mapper.js.map