import { Queue } from "bullmq";
export declare const queue: Queue<any, any, string>;
export declare type CursorInfo = {
    tokenSetId: string;
};
export declare const addToQueue: (cursor?: CursorInfo | undefined) => Promise<void>;
//# sourceMappingURL=backfill-top-bid-queue.d.ts.map