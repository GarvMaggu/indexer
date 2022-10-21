import { Queue } from "bullmq";
export declare const queue: Queue<any, any, string>;
/**
 * Add a job to the queue with the beginning of the day you want to sync.
 * Beginning of the day is a unix timestamp, starting at 00:00:00
 *
 * @param startTime When startTime is null, we assume we want to calculate the previous day volume.
 * @param ignoreInsertedRows When set to true, we force an update/insert of daily_volume rows, even when they already exist
 * @param retry Retry mechanism
 */
export declare const addToQueue: (startTime?: number | null | undefined, ignoreInsertedRows?: boolean, retry?: number) => Promise<void>;
//# sourceMappingURL=daily-volumes.d.ts.map