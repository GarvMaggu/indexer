export declare type TokenSet = {
    id: string;
    schemaHash: string;
    schema?: object;
    contract: string;
    startTokenId: string;
    endTokenId: string;
};
export declare const save: (tokenSets: TokenSet[]) => Promise<TokenSet[]>;
//# sourceMappingURL=token-range.d.ts.map