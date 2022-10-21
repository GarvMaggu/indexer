"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addToQueue = exports.queue = void 0;
const bullmq_1 = require("bullmq");
const crypto_1 = require("crypto");
const logger_1 = require("@/common/logger");
const redis_1 = require("@/common/redis");
const index_1 = require("@/config/index");
const daily_volume_1 = require("../../models/daily-volumes/daily-volume");
const QUEUE_NAME = "calculate-daily-volumes";
exports.queue = new bullmq_1.Queue(QUEUE_NAME, {
    connection: redis_1.redis.duplicate(),
    defaultJobOptions: {
        removeOnComplete: true,
    },
});
new bullmq_1.QueueScheduler(QUEUE_NAME, { connection: redis_1.redis.duplicate() });
if (index_1.config.doBackgroundWork) {
    const worker = new bullmq_1.Worker(QUEUE_NAME, async (job) => {
        // Get the startTime and endTime of the day we want to calculate
        const startTime = job.data.startTime;
        const ignoreInsertedRows = job.data.ignoreInsertedRows;
        let retry = job.data.retry;
        await daily_volume_1.DailyVolume.calculateDay(startTime, ignoreInsertedRows);
        if (await daily_volume_1.DailyVolume.tickLock()) {
            logger_1.logger.info("daily-volumes", `All daily volumes are finished processing, updating the collections table`);
            const updated = await daily_volume_1.DailyVolume.updateCollections(true);
            if (updated) {
                logger_1.logger.info("daily-volumes", `Finished updating the collections table`);
            }
            else {
                if (retry < 5) {
                    retry++;
                    logger_1.logger.info("daily-volumes", `Something went wrong with updating the collections, will retry in a couple of minutes, retry ${retry}`);
                    await (0, exports.addToQueue)(startTime, true, retry);
                }
                else {
                    logger_1.logger.info("daily-volumes", `Something went wrong with retrying during updating the collection, stopping...`);
                }
            }
        }
        return true;
    }, { connection: redis_1.redis.duplicate(), concurrency: 1 });
    worker.on("error", (error) => {
        logger_1.logger.error(QUEUE_NAME, `Worker errored: ${error}`);
    });
}
/**
 * Add a job to the queue with the beginning of the day you want to sync.
 * Beginning of the day is a unix timestamp, starting at 00:00:00
 *
 * @param startTime When startTime is null, we assume we want to calculate the previous day volume.
 * @param ignoreInsertedRows When set to true, we force an update/insert of daily_volume rows, even when they already exist
 * @param retry Retry mechanism
 */
const addToQueue = async (startTime, ignoreInsertedRows = true, retry = 0) => {
    let dayBeginning = new Date();
    if (!startTime) {
        dayBeginning = new Date();
        dayBeginning.setUTCHours(0, 0, 0, 0);
        startTime = dayBeginning.getTime() / 1000 - 24 * 3600;
    }
    await exports.queue.add((0, crypto_1.randomUUID)(), {
        startTime,
        ignoreInsertedRows,
        retry,
    }, {
        delay: retry ? retry ** 2 * 120 * 1000 : 0,
    });
};
exports.addToQueue = addToQueue;
//# sourceMappingURL=daily-volumes.js.map