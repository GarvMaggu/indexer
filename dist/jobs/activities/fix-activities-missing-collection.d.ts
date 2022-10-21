import { Queue } from "bullmq";
export declare const queue: Queue<any, any, string>;
export declare const addToQueue: (contract: string, tokenId: string, retry?: number) => Promise<void>;
//# sourceMappingURL=fix-activities-missing-collection.d.ts.map