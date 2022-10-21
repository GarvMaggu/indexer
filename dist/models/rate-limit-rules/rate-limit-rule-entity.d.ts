export declare type RateLimitRuleUpdateParams = {
    method?: string;
    tier?: number;
    options?: RateLimitRuleOptions;
    apiKey?: string;
};
export declare type RateLimitRuleOptions = {
    keyPrefix?: string | undefined;
    points?: number | undefined;
    duration?: number | undefined;
};
export declare type RateLimitRuleEntityParams = {
    id: number;
    route: string;
    method: string;
    tier: number;
    api_key: string;
    options: RateLimitRuleOptions;
    created_at: string;
};
export declare class RateLimitRuleEntity {
    id: number;
    route: string;
    method: string;
    tier: number;
    apiKey: string;
    options: RateLimitRuleOptions;
    createdAt: string;
    constructor(params: RateLimitRuleEntityParams);
}
//# sourceMappingURL=rate-limit-rule-entity.d.ts.map