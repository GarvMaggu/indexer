"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserActivitiesEntity = void 0;
const utils_1 = require("@/common/utils");
const activities_entity_1 = require("@/models/activities/activities-entity");
class UserActivitiesEntity extends activities_entity_1.ActivitiesEntity {
    constructor(params) {
        super(params);
        this.address = (0, utils_1.fromBuffer)(params.address);
    }
}
exports.UserActivitiesEntity = UserActivitiesEntity;
//# sourceMappingURL=user-activities-entity.js.map