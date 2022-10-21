import { Queue } from "bullmq";
export declare const queue: Queue<any, any, string>;
export declare type JobData = {
    currency: string;
};
export declare const addToQueue: (data: JobData) => Promise<void>;
//# sourceMappingURL=index.d.ts.map