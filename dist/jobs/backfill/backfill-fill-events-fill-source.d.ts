import { Queue } from "bullmq";
export declare const queue: Queue<any, any, string>;
export declare const addToQueue: (timestamp: number, logIndex: number, batchIndex: number) => Promise<void>;
//# sourceMappingURL=backfill-fill-events-fill-source.d.ts.map