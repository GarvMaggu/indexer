import { Queue } from "bullmq";
export declare const bidUpdateBatchSize = 200;
export declare const queue: Queue<any, any, string>;
export declare const addToQueue: (tokenSetId: string, contract?: string | null, tokenId?: string | null) => Promise<void>;
//# sourceMappingURL=top-bid-update-queue.d.ts.map