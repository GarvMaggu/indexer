export declare type SourcesEntityParams = {
    id: number;
    domain: string;
    domainHash: string;
    name: string;
    address: string;
    metadata: SourcesMetadata;
    optimized: boolean;
};
export declare type SourcesMetadata = {
    adminTitle?: string;
    adminIcon?: string;
    title?: string;
    icon?: string;
    url?: string;
    tokenUrlMainnet?: string;
    tokenUrlRinkeby?: string;
};
export declare class SourcesEntity {
    id: number;
    name: string;
    domain: string;
    domainHash: string;
    address: string;
    metadata: SourcesMetadata;
    optimized: boolean;
    constructor(params: SourcesEntityParams);
}
//# sourceMappingURL=sources-entity.d.ts.map