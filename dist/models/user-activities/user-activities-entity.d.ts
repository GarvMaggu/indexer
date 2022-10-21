/// <reference types="node" />
import { ActivitiesEntity, ActivitiesEntityInsertParams, ActivitiesEntityParams } from "@/models/activities/activities-entity";
export declare type UserActivitiesEntityInsertParams = ActivitiesEntityInsertParams & {
    address: string;
};
export declare type UserActivitiesEntityParams = ActivitiesEntityParams & {
    address: Buffer;
};
export declare class UserActivitiesEntity extends ActivitiesEntity {
    address: string;
    constructor(params: UserActivitiesEntityParams);
}
//# sourceMappingURL=user-activities-entity.d.ts.map