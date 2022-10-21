export declare type AttributeKeysEntityParamsUpdateParams = {
    attributeCount?: number;
};
export declare type AttributeKeysEntityParams = {
    id: number;
    collection_id: string;
    key: string;
    kind: string;
    rank: number;
    attribute_count: number;
};
export declare class AttributeKeysEntity {
    id: number;
    collectionId: string;
    key: string;
    kind: string;
    rank: number;
    attributeCount: number;
    constructor(params: AttributeKeysEntityParams);
}
//# sourceMappingURL=attribute-keys-entity.d.ts.map