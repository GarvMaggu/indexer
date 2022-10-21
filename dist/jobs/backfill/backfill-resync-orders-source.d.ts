import { Queue } from "bullmq";
export declare const queue: Queue<any, any, string>;
export declare const addToQueue: (continuation?: string, maxId?: string) => Promise<void>;
//# sourceMappingURL=backfill-resync-orders-source.d.ts.map