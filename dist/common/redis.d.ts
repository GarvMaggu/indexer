import { BulkJobOptions } from "bullmq";
import Redis from "ioredis";
import Redlock from "redlock";
export declare const redis: Redis.Redis;
export declare const redisSubscriber: Redis.Redis;
export declare const rateLimitRedis: Redis.Redis;
export declare const redlock: Redlock;
export declare type BullMQBulkJob = {
    name: string;
    data: any;
    opts?: BulkJobOptions;
};
export declare const acquireLock: (name: string, expirationInSeconds?: number) => Promise<boolean>;
export declare const extendLock: (name: string, expirationInSeconds: number) => Promise<boolean>;
export declare const releaseLock: (name: string) => Promise<void>;
export declare const getLockExpiration: (name: string) => Promise<number>;
//# sourceMappingURL=redis.d.ts.map