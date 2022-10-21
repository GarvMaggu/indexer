import { Request } from "@hapi/hapi";
import { ApiKeyEntity, ApiKeyUpdateParams } from "@/models/api-keys/api-key-entity";
export declare type ApiKeyRecord = {
    app_name: string;
    website: string;
    email: string;
    tier: number;
    key?: string;
};
export declare type NewApiKeyResponse = {
    key: string;
};
export declare class ApiKeyManager {
    private static apiKeys;
    /**
     * Create a new key, leave the ApiKeyRecord.key empty to generate a new key (uuid) in this function
     *
     * @param values
     */
    create(values: ApiKeyRecord): Promise<NewApiKeyResponse | boolean>;
    static deleteCachedApiKey(key: string): Promise<void>;
    /**
     * When a user passes an api key, we retrieve the details from redis
     * In case the details are not in redis (new redis, api key somehow disappeared from redis) we try to fetch it from
     * the database. In case we couldn't find the key in the database, the key must be wrong. To avoid us doing the
     * lookup constantly in the database, we set a temporary hash key in redis with one value { empty: true }
     *
     * @param key
     */
    static getApiKey(key: string): Promise<ApiKeyEntity | null>;
    /**
     * Log usage of the api key in the logger
     *
     * @param request
     */
    static logUsage(request: Request): Promise<void>;
    static update(key: string, fields: ApiKeyUpdateParams): Promise<void>;
    static notifyApiKeyCreated(values: ApiKeyRecord): Promise<void>;
}
//# sourceMappingURL=index.d.ts.map