import { Queue } from "bullmq";
export declare const queue: Queue<any, any, string>;
export declare type CursorInfo = {
    txHash: string;
    logIndex: number;
    batchIndex: number;
    createdAt: string;
};
export declare const addToQueue: (cursor?: CursorInfo | undefined) => Promise<void>;
//# sourceMappingURL=backfill-fill-events-wash-trading-score.d.ts.map