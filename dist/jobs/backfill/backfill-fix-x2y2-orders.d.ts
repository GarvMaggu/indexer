import { Queue } from "bullmq";
export declare const queue: Queue<any, any, string>;
export declare type Info = {
    maker: string;
    tokenSetId: string;
};
export declare const addToQueue: (infos: Info[]) => Promise<void>;
//# sourceMappingURL=backfill-fix-x2y2-orders.d.ts.map