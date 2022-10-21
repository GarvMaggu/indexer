/// <reference types="jest" />
declare type Transaction = {
    version: string;
    id: string;
};
declare type ArweaveSyncResult = {
    lastBlock?: number;
    lastCursor?: string;
    done: boolean;
    transactions: Transaction[];
};
export declare const syncArweave: (options: {
    fromBlock?: number;
    toBlock?: number;
    afterCursor?: string;
    pending?: boolean;
}) => Promise<ArweaveSyncResult>;
export {};
//# sourceMappingURL=index.d.ts.map