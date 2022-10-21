export declare class Rarity {
    static getCollectionTokensRarity(collectionId: string): Promise<import("@poprank/rankings").NftWithRank[]>;
    static getValuesCount(collectionId: string): Promise<{
        key: string;
        count: number;
    }[]>;
}
//# sourceMappingURL=rarity.d.ts.map