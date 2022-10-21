import { Queue } from "bullmq";
export declare const queue: Queue<any, any, string>;
export declare const addToQueue: (timestamp: number, txHash: string, logIndex: number, batchIndex: number) => Promise<void>;
//# sourceMappingURL=backfill-sales-usd-price.d.ts.map