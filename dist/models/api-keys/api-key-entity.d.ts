export declare enum ApiKeyPermission {
    override_collection_refresh_cool_down = "override_collection_refresh_cool_down",
    assign_collection_to_community = "assign_collection_to_community"
}
export declare type ApiKeyUpdateParams = {
    website?: string;
    tier?: number;
    active?: boolean;
};
export declare type ApiKeyEntityParams = {
    key: string;
    app_name: string;
    website: string;
    email: string;
    created_at: string;
    active: boolean;
    tier: number;
    permissions: Record<string, unknown>;
};
export declare class ApiKeyEntity {
    key: string;
    appName: string;
    website: string;
    email: string;
    createdAt: string;
    active: boolean;
    tier: number;
    permissions: Record<ApiKeyPermission, unknown>;
    constructor(params: ApiKeyEntityParams);
}
//# sourceMappingURL=api-key-entity.d.ts.map