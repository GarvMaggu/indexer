export declare class DailyVolume {
    private static lockKey;
    /**
     * Check if the daily volume for this day was already calculated and stored
     * We will keep a collection_id: -1 and timestamp in the database for each day we processed already
     *
     * @param startTime
     */
    static isDaySynced(startTime: number): Promise<boolean>;
    /**
     * Calculate for the given day the sales volume and store these values in the database:
     * - daily_volumes: so we can get historical data for each day
     * - collections: update each collection with the rank and sales volume, for fast retrieval in APIs
     *
     * Once these updates are done, add a collection_id: -1, timestamp to daily_volumes to indicate we calculated this
     * day already
     *
     * @param startTime
     * @param ignoreInsertedRows
     */
    static calculateDay(startTime: number, ignoreInsertedRows?: boolean): Promise<boolean>;
    /**
     * Update the collections table (fields day1_volume, day1_rank, etc) with latest values we have from daily_volumes
     *
     * @return boolean Returns false when it fails to update the collection, will need to reschedule the job
     */
    static updateCollections(useCleanValues?: boolean): Promise<boolean>;
    /**
     * Once a day calculate the volume changes in percentages from the previous period
     * We will calculate day 1, day 7 and day 30 percentage changes
     * The calculation is a sliding window, so for example for 7 day we take the last 7 days and divide them by the
     * 7 days before that
     *
     * @param days The amount of days you want to calculate volume changes for, this should be 1, 7 or 30
     */
    static calculateVolumeChange(days: number, useCleanValues?: boolean): Promise<boolean>;
    /**
     * Cache the floor sale price of all collections of a specific previous period into the collections table
     * For example if you pass period: 7 it will take the floor_sale_price 7 days ago and fetch that
     * floor_sale_price from daily_volumes, and then update that collection's day7_floor_sale_price
     *
     * @param period The previous period you want to fetch and update into collections, can be 1/7/30
     */
    static cacheFloorSalePrice(period: number, useCleanValues?: boolean): Promise<boolean>;
    /**
     * Merge the individual arrays of day summaries together, make sure all fields exist for each collection_id
     *
     * @param day1
     * @param day7
     * @param day30
     */
    static mergeArrays(day1: any, day7: any, day30: any, allTime: any): any[];
    /**
     * Put a lock into place so no 2 processes can start calculations at the same time
     *
     * @param jobs
     */
    static initiateLock(jobs: number): Promise<boolean>;
    /**
     * Check if calculations are running
     */
    static isJobRunning(): Promise<boolean>;
    /**
     * Each time a job is finished, do a tick, and decrease the number on the lock
     * Once we reach 0, we know we don't have any more jobs to run, and we can finish by updating our calculations table
     * with the latest values.
     * For the cronjob that syncs daily volumes, this lock will not exist, and it will decrease the value to -1
     * which is fine, and just cleans up the lock anyway
     *
     * @return boolean When all jobs are done return true, otherwise we return false
     */
    static tickLock(): Promise<boolean>;
}
//# sourceMappingURL=daily-volume.d.ts.map