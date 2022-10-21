export declare type TokenSet = {
    id: string;
    schemaHash: string;
    schema?: {
        kind: "attribute";
        data: {
            collection: string;
            isNonFlagged?: boolean;
            attributes: [
                {
                    key: string;
                    value: string;
                }
            ];
        };
    } | {
        kind: "collection-non-flagged";
        data: {
            collection: string;
        };
    } | {
        kind: "collection";
        data: {
            collection: string;
        };
    } | {
        kind: "token-set";
        data: {
            tokenSetId: string;
        };
    };
    items?: {
        contract: string;
        tokenIds: string[];
    };
};
export declare const save: (tokenSets: TokenSet[]) => Promise<TokenSet[]>;
//# sourceMappingURL=token-list.d.ts.map