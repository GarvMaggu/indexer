import { Queue } from "bullmq";
export declare const queue: Queue<any, any, string>;
export declare const getLockName: (method: string) => string;
export declare const getRateLimitLockName: (method: string) => string;
export declare const addToQueue: (method: string, delay?: number) => Promise<void>;
//# sourceMappingURL=process-queue.d.ts.map