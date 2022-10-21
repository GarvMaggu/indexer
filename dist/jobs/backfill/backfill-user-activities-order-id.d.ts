import { Queue } from "bullmq";
export declare const queue: Queue<any, any, string>;
export declare type CursorInfo = {
    activityId: number;
};
export declare const addToQueue: (cursor?: CursorInfo | undefined) => Promise<void>;
//# sourceMappingURL=backfill-user-activities-order-id.d.ts.map