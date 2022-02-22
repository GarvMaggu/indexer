import { Job, Queue, QueueScheduler, Worker } from "bullmq";
import { v4 as uuidv4 } from "uuid";

import { syncArweave } from "@/arweave-sync/index";
import { logger } from "@/common/logger";
import { redis } from "@/common/redis";
import { config } from "@/config/index";

const QUEUE_NAME = "arweave-sync-pending";

export const queue = new Queue(QUEUE_NAME, {
  connection: redis.duplicate(),
  defaultJobOptions: {
    // In order to be as lean as possible, leave retrying
    // any failed processes to be done by subsequent jobs
    removeOnComplete: true,
    removeOnFail: true,
  },
});
new QueueScheduler(QUEUE_NAME, { connection: redis.duplicate() });

// BACKGROUND WORKER ONLY
if (config.doBackgroundWork) {
  const worker = new Worker(
    QUEUE_NAME,
    async (_job: Job) => {
      try {
        // The code below assumes we cannot have more than 100 (or whatever
        // is the query size limit for Arweave's gql endpoint) transactions
        // pending in the Arweave mempool.
        await syncArweave({ pending: true });
      } catch (error) {
        logger.error(QUEUE_NAME, `Arweave realtime syncing failed: ${error}`);
        throw error;
      }
    },
    { connection: redis.duplicate(), concurrency: 1 }
  );
  worker.on("error", (error) => {
    logger.error(QUEUE_NAME, `Worker errored: ${error}`);
  });
}

export const addToQueue = async () => {
  await queue.add(uuidv4(), {});
};