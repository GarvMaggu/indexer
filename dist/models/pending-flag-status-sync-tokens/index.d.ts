export declare type PendingFlagStatusSyncToken = {
    collectionId: string;
    contract: string;
    tokenId: string;
    isFlagged: number;
};
/**
 * Class that manage redis list of tokens, pending flag status sync
 */
export declare class PendingFlagStatusSyncTokens {
    key: string;
    constructor(collectionId: string);
    add(tokens: PendingFlagStatusSyncToken[], prioritized?: boolean): Promise<number>;
    get(count?: number): Promise<PendingFlagStatusSyncToken[]>;
    count(): Promise<number>;
}
//# sourceMappingURL=index.d.ts.map