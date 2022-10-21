import { Queue } from "bullmq";
export declare const queue: Queue<any, any, string>;
export declare type CursorInfo = {
    id: string;
    createdAt: string;
};
export declare const addToQueue: (cursor?: CursorInfo | undefined) => Promise<void>;
//# sourceMappingURL=backfill-remove-buy-order-events.d.ts.map