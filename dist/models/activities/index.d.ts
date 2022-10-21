import { ActivitiesEntity, ActivitiesEntityInsertParams } from "@/models/activities/activities-entity";
export declare class Activities {
    static addActivities(activities: ActivitiesEntityInsertParams[]): Promise<void>;
    static deleteByBlockHash(blockHash: string): Promise<null>;
    static getActivities(continuation?: null | string, limit?: number, byEventTimestamp?: boolean): Promise<ActivitiesEntity[]>;
    static updateMissingCollectionId(contract: string, tokenId: string, collectionId: string): Promise<null>;
    static getCollectionActivities(collectionId?: string, community?: string, collectionsSetId?: string, createdBefore?: null | string, types?: string[], limit?: number, sortBy?: string, includeMetadata?: boolean): Promise<ActivitiesEntity[]>;
    static getTokenActivities(contract: string, tokenId: string, createdBefore?: null | string, types?: string[], limit?: number, sortBy?: string): Promise<ActivitiesEntity[]>;
}
//# sourceMappingURL=index.d.ts.map