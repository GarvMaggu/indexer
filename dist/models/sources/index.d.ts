import { SourcesEntity, SourcesMetadata } from "@/models/sources/sources-entity";
export declare class Sources {
    private static instance;
    sources: {
        [id: number]: SourcesEntity;
    };
    sourcesByName: {
        [name: string]: SourcesEntity;
    };
    sourcesByAddress: {
        [address: string]: SourcesEntity;
    };
    sourcesByDomain: {
        [domain: string]: SourcesEntity;
    };
    sourcesByDomainHash: {
        [domainHash: string]: SourcesEntity;
    };
    private constructor();
    private loadData;
    static getCacheKey(): string;
    static getInstance(): Promise<Sources>;
    static forceDataReload(): Promise<void>;
    static getDefaultSource(): SourcesEntity;
    static syncSources(): Promise<void>;
    static addFromJson(id: number, domain: string, domainHash: string, name: string, address: string, metadata: object): Promise<void>;
    create(domain: string, address: string, metadata?: object): Promise<SourcesEntity>;
    update(domain: string, metadata?: SourcesMetadata, optimized?: boolean): Promise<void>;
    get(id: number, contract?: string, tokenId?: string, optimizeCheckoutURL?: boolean): SourcesEntity | undefined;
    getByDomain(domain: string, returnDefault?: boolean): SourcesEntity | undefined;
    getByDomainHash(domainHash: string): SourcesEntity | undefined;
    getByName(name: string, returnDefault?: boolean): SourcesEntity | undefined;
    getByAddress(address: string, options?: {
        contract?: string;
        tokenId?: string;
        returnDefault?: boolean;
    }): SourcesEntity | undefined;
    getOrInsert(source: string): Promise<SourcesEntity>;
    getTokenUrl(sourceEntity: SourcesEntity, contract: string, tokenId: string): string | undefined;
}
//# sourceMappingURL=index.d.ts.map