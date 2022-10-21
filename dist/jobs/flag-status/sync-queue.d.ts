import { Queue } from "bullmq";
export declare const queue: Queue<any, any, string>;
export declare const getLockName: () => string;
export declare const addToQueue: (collectionId: string, contract: string, delay?: number) => Promise<void>;
//# sourceMappingURL=sync-queue.d.ts.map