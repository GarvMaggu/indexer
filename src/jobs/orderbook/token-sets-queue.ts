import { Job, Queue, QueueScheduler, Worker } from "bullmq";

import { logger } from "@/common/logger";
import { redis } from "@/common/redis";
import { config } from "@/config/index";
import * as tokenListSet from "@/orderbook/token-sets/token-list";

const QUEUE_NAME = "orderbook-token-sets-queue";

export const queue = new Queue(QUEUE_NAME, {
  connection: redis.duplicate(),
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: "exponential",
      delay: 10000,
    },
    removeOnComplete: 10000,
    removeOnFail: 10000,
  },
});
new QueueScheduler(QUEUE_NAME, { connection: redis.duplicate() });

// BACKGROUND WORKER ONLY
if (config.doBackgroundWork) {
  const worker = new Worker(
    QUEUE_NAME,
    async (job: Job) => {
      const { id, schemaHash, schema, contract, tokenIds } =
        job.data as tokenListSet.TokenSet;

      try {
        await tokenListSet.save([
          { id, schemaHash, schema, contract, tokenIds },
        ]);
      } catch (error) {
        logger.error(
          QUEUE_NAME,
          `Failed to process order ${job.data}: ${error}`
        );
        throw error;
      }
    },
    { connection: redis.duplicate(), concurrency: 10 }
  );
  worker.on("error", (error) => {
    logger.error(QUEUE_NAME, `Worker errored: ${error}`);
  });
}

export const addToQueue = async (tokenSets: tokenListSet.TokenSet[]) => {
  await queue.addBulk(
    tokenSets.map((tokenSet) => ({
      name: tokenSet.id,
      data: tokenSet,
    }))
  );
};