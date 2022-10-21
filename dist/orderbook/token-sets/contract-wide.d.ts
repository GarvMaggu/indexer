export declare type TokenSet = {
    id: string;
    schemaHash: string;
    schema?: object;
    contract: string;
};
export declare const save: (tokenSets: TokenSet[]) => Promise<TokenSet[]>;
//# sourceMappingURL=contract-wide.d.ts.map