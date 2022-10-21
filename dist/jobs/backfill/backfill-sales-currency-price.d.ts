import { Queue } from "bullmq";
export declare const queue: Queue<any, any, string>;
export declare const addToQueue: (createdAt: number, txHash: string, logIndex: number, batchIndex: number) => Promise<void>;
//# sourceMappingURL=backfill-sales-currency-price.d.ts.map