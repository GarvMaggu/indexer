import { UserActivitiesEntity, UserActivitiesEntityInsertParams } from "@/models/user-activities/user-activities-entity";
export declare class UserActivities {
    static addActivities(activities: UserActivitiesEntityInsertParams[]): Promise<void>;
    static getActivities(users: string[], collections?: string[], community?: string, createdBefore?: null | string, types?: string[], limit?: number, sortBy?: string): Promise<UserActivitiesEntity[]>;
    static deleteByBlockHash(blockHash: string): Promise<null>;
    static updateMissingCollectionId(contract: string, tokenId: string, collectionId: string): Promise<null>;
}
//# sourceMappingURL=index.d.ts.map