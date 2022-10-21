import { Queue } from "bullmq";
export declare const queue: Queue<any, any, string>;
export declare const addToQueue: (contract: string | string[], tokenId?: string, delay?: number, forceRefresh?: boolean) => Promise<void>;
//# sourceMappingURL=metadata-queue.d.ts.map