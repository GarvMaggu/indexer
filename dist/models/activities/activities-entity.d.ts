/// <reference types="node" />
import { CollectionsMetadata } from "@/models/collections/collections-entity";
export declare enum ActivityType {
    sale = "sale",
    ask = "ask",
    transfer = "transfer",
    mint = "mint",
    bid = "bid",
    bid_cancel = "bid_cancel",
    ask_cancel = "ask_cancel"
}
export declare type ActivitiesEntityInsertParams = {
    type: ActivityType;
    hash: string;
    contract: string;
    collectionId: string;
    tokenId: string | null;
    orderId: string | null;
    fromAddress: string;
    toAddress: string | null;
    price: number;
    amount: number;
    blockHash: string | null;
    eventTimestamp: number;
    metadata?: ActivityMetadata;
};
export declare type ActivitiesEntityParams = {
    id: number;
    hash: string;
    type: ActivityType;
    contract: Buffer;
    collection_id: string;
    token_id: string | null;
    order_id: string | null;
    from_address: Buffer;
    to_address: Buffer | null;
    price: number;
    amount: number;
    block_hash: Buffer | null;
    event_timestamp: number;
    created_at: Date;
    metadata: ActivityMetadata;
    token_name: string;
    token_image: string;
    collection_name: string;
    collection_metadata: CollectionsMetadata;
    order_side: string;
    order_source_id_int: number;
    order_kind: string;
};
export declare type ActivityMetadata = {
    transactionHash?: string;
    logIndex?: number;
    batchIndex?: number;
    orderId?: string;
    orderSide?: string;
    orderSourceIdInt?: number;
    orderKind?: string;
};
export declare type ActivityToken = {
    tokenId: string | null;
    tokenName?: string;
    tokenImage?: string;
};
export declare type ActivityCollection = {
    collectionId: string | null;
    collectionName?: string;
    collectionImage?: string;
};
export declare type ActivityOrder = {
    id: string | null;
    side: string | null;
    sourceIdInt: number | null;
    kind: string | null;
};
export declare class ActivitiesEntity {
    id: number;
    hash: string;
    type: ActivityType;
    contract: string;
    collectionId: string;
    tokenId: string | null;
    orderId: string | null;
    fromAddress: string;
    toAddress: string | null;
    price: number;
    amount: number;
    blockHash: string | null;
    eventTimestamp: number;
    createdAt: Date;
    metadata: ActivityMetadata;
    token?: ActivityToken;
    collection?: ActivityCollection;
    order?: ActivityOrder;
    constructor(params: ActivitiesEntityParams);
}
//# sourceMappingURL=activities-entity.d.ts.map