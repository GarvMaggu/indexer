import { Queue } from "bullmq";
export declare const queue: Queue<any, any, string>;
export declare type TopBidInfo = {
    kind: string;
    collectionId: string;
    txHash: string | null;
    txTimestamp: number | null;
};
export declare const addToQueue: (topBidInfos: TopBidInfo[]) => Promise<void>;
//# sourceMappingURL=top-bid-queue.d.ts.map