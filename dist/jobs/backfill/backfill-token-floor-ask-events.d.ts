import { Queue } from "bullmq";
export declare const queue: Queue<any, any, string>;
export declare type Info = {
    id: number;
};
export declare const addToQueue: (infos: Info[]) => Promise<void>;
//# sourceMappingURL=backfill-token-floor-ask-events.d.ts.map