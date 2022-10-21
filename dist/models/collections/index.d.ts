import { CollectionsEntity, CollectionsEntityUpdateParams } from "@/models/collections/collections-entity";
export declare class Collections {
    static getById(collectionId: string, readReplica?: boolean): Promise<CollectionsEntity | null>;
    static getByContractAndTokenId(contract: string, tokenId: number, readReplica?: boolean): Promise<CollectionsEntity | null>;
    static getByTokenSetId(tokenSetId: string): Promise<CollectionsEntity | null>;
    static updateCollectionCache(contract: string, tokenId: string): Promise<void>;
    static update(collectionId: string, fields: CollectionsEntityUpdateParams): Promise<null>;
    static getCollectionsMintedBetween(from: number, to: number, limit?: number): Promise<CollectionsEntity[]>;
    static getTopCollectionsByVolume(limit?: number): Promise<CollectionsEntity[]>;
    static recalculateCollectionFloorSell(collection: string): Promise<void>;
    static recalculateContractFloorSell(contract: string): Promise<void>;
    static recalculateContractTopBuy(contract: string): Promise<void>;
}
//# sourceMappingURL=index.d.ts.map