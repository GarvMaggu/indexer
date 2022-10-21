export declare type AttributesEntityUpdateParams = {
    tokenCount?: number;
    onSaleCount?: number;
    floorSellValue?: number | null;
    topBuyValue?: number | null;
    sellUpdatedAt?: string | null;
    buyUpdatedAt?: string | null;
};
export declare type AttributesEntityParams = {
    id: number;
    attribute_key_id: number;
    value: string;
    token_count: number;
    on_sale_count: number;
    floor_sell_value: number;
    top_buy_value: number;
    sell_updated_at: string;
    buy_updated_at: string;
    collection_id: string;
    kind: string;
    key: string;
};
export declare class AttributesEntity {
    id: number;
    attributeKeyId: number;
    value: string;
    tokenCount: number;
    onSaleCount: number;
    floorSellValue: number;
    topBuyValue: number;
    sellUpdatedAt: string;
    buyUpdatedAt: string;
    collectionId: string;
    kind: string;
    key: string;
    constructor(params: AttributesEntityParams);
}
//# sourceMappingURL=attributes-entity.d.ts.map