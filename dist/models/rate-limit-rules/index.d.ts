import { RateLimitRuleEntity, RateLimitRuleOptions, RateLimitRuleUpdateParams } from "@/models/rate-limit-rules/rate-limit-rule-entity";
import { RateLimiterRedis } from "rate-limiter-flexible";
export declare class RateLimitRules {
    private static instance;
    rulesEntities: Map<string, RateLimitRuleEntity>;
    rules: Map<string, RateLimiterRedis>;
    private constructor();
    private loadData;
    static getRuleKey(route: string, method: string, tier: number | null, apiKey: string): string;
    static getDefaultRuleKeyForTier(tier: number): string;
    static getCacheKey(): string;
    static forceDataReload(): Promise<void>;
    static getInstance(): Promise<RateLimitRules>;
    static create(route: string, apiKey: string, method: string, tier: number | null, options: RateLimitRuleOptions): Promise<RateLimitRuleEntity>;
    static update(id: number, fields: RateLimitRuleUpdateParams): Promise<void>;
    static delete(id: number): Promise<void>;
    static getApiKeyRateLimits(key: string): Promise<RateLimitRuleEntity[]>;
    getRule(route: string, method: string, tier: number, apiKey?: string): RateLimiterRedis | null;
    getAllRules(): Map<string, RateLimitRuleEntity>;
}
//# sourceMappingURL=index.d.ts.map