import { Queue } from "bullmq";
import { EventDataKind } from "@/events-sync/data";
export declare const queue: Queue<any, any, string>;
export declare const addToQueue: (fromBlock: number, toBlock: number, options?: {
    blocksPerBatch?: number | undefined;
    prioritized?: boolean | undefined;
    backfill?: boolean | undefined;
    syncDetails?: {
        method: "events";
        events: EventDataKind[];
    } | {
        method: "address";
        address: string;
    } | undefined;
} | undefined) => Promise<void>;
//# sourceMappingURL=backfill-queue.d.ts.map