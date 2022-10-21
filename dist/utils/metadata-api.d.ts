export declare class MetadataApi {
    static getCollectionMetadata(contract: string, tokenId: string, options?: {
        allowFallback?: boolean;
    }): Promise<{
        id: string;
        slug: string;
        name: string;
        community: string | null;
        metadata: object | null;
        royalties: object | null;
        contract: string;
        tokenIdRange: [string, string] | null;
        tokenSetId: string | null;
        isFallback?: boolean | undefined;
    } | {
        id: string;
        slug: string;
        name: any;
        community: null;
        metadata: null;
        royalties: null;
        contract: string;
        tokenIdRange: null;
        tokenSetId: string;
    }>;
    static getTokensMetadata(tokens: {
        contract: string;
        tokenId: string;
    }[], useAltUrl?: boolean, method?: string): Promise<{
        contract: string;
        tokenId: string;
        collection: string;
        flagged: boolean;
        name?: string | undefined;
        description?: string | undefined;
        imageUrl?: string | undefined;
        mediaUrl?: string | undefined;
        attributes: {
            key: string;
            value: string;
            kind: "string" | "number" | "date" | "range";
            rank?: number;
        }[];
    }[]>;
}
export { MetadataApi as default };
//# sourceMappingURL=metadata-api.d.ts.map