import { Queue } from "bullmq";
export declare const queue: Queue<any, any, string>;
export declare const addToQueue: (contract: string, tokenId: string, delay?: number, forceRefresh?: boolean) => Promise<void>;
//# sourceMappingURL=resync-attribute-cache.d.ts.map