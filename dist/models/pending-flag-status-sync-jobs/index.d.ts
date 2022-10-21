export declare type SyncFlagStatusJobInfo = {
    kind: "collection";
    data: {
        collectionId: string;
        backfill: boolean;
    };
} | {
    kind: "tokens";
    data: {
        collectionId: string;
        contract: string;
        tokens: {
            tokenId: string;
            tokenIsFlagged: number;
        }[];
    };
};
/**
 * Class that manage redis list of tokens, pending flag status sync
 */
export declare class PendingFlagStatusSyncJobs {
    key: string;
    add(jobs: SyncFlagStatusJobInfo[], prioritized?: boolean): Promise<string | number>;
    next(): Promise<SyncFlagStatusJobInfo | null>;
}
//# sourceMappingURL=index.d.ts.map