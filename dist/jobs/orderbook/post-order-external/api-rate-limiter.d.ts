/// <reference types="ioredis" />
export declare class OrderbookApiRateLimiter {
    private key;
    private limit;
    private interval;
    constructor(orderbook: string, orderbookApiKey: string, limit: number, interval: number);
    reachedLimit(): Promise<boolean>;
    getExpiration(): Promise<number>;
    setExpiration(ttl: number): Promise<import("ioredis").BooleanResponse>;
}
//# sourceMappingURL=api-rate-limiter.d.ts.map