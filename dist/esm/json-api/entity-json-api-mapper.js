"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EntityJSONAPIMapper = void 0;
class EntityJSONAPIMapper {
    type;
    constructor(type) {
        this.type = type;
    }
    mapEntity(entity) {
        const attributes = entity.toPrimitives();
        delete attributes.id;
        return {
            data: {
                type: this.type,
                id: entity.id.value,
                attributes: attributes,
            },
        };
    }
    mapEntities(entities) {
        return { data: entities.map((e) => this.mapEntity(e).data) };
    }
}
exports.EntityJSONAPIMapper = EntityJSONAPIMapper;
//# sourceMappingURL=entity-json-api-mapper.js.map