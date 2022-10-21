import { Queue } from "bullmq";
export declare const queue: Queue<any, any, string>;
export declare const addToQueue: (fromBlock: number, toBlock: number, options?: {
    blocksPerBatch?: number | undefined;
} | undefined) => Promise<void>;
//# sourceMappingURL=backfill-queue.d.ts.map