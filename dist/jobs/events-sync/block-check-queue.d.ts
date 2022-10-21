import { Job, Queue } from "bullmq";
export declare const queue: Queue<any, any, string>;
export declare const addToQueue: (block: number, blockHash?: string | undefined, delayInSeconds?: number) => Promise<Job<any, any, string>>;
//# sourceMappingURL=block-check-queue.d.ts.map