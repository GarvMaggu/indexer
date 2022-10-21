import { TokensEntity, TokensEntityUpdateParams } from "@/models/tokens/tokens-entity";
export declare type TokenAttributes = {
    attributeId: number;
    key: string;
    value: string;
    attributeKeyId: number;
    collectionId: string;
    floorSellValue: number | null;
};
export declare class Tokens {
    static getByContractAndTokenId(contract: string, tokenId: string, readReplica?: boolean): Promise<TokensEntity | null>;
    static update(contract: string, tokenId: string, fields: TokensEntityUpdateParams): Promise<null>;
    static getTokenAttributes(contract: string, tokenId: string): Promise<TokenAttributes[]>;
    static getTokenAttributesKeyCount(collection: string, key: string): Promise<any>;
    static getTokenAttributesValueCount(collection: string, key: string, value: string): Promise<any>;
    static countTokensInCollection(collectionId: string): Promise<any>;
    static getSingleToken(collectionId: string): Promise<any>;
    static getTokenIdsInCollection(collectionId: string, contract?: string, nonFlaggedOnly?: boolean, readReplica?: boolean): Promise<string[]>;
    /**
     * Return the lowest sell price and number of tokens on sale for the given attribute
     * @param collection
     * @param attributeKey
     * @param attributeValue
     */
    static getSellFloorValueAndOnSaleCount(collection: string, attributeKey: string, attributeValue: string): Promise<{
        floorSellValue: any;
        onSaleCount: any;
    }>;
    static recalculateTokenFloorSell(contract: string, tokenId: string): Promise<void>;
    static recalculateTokenTopBid(contract: string, tokenId: string): Promise<void>;
    /**
     * Get top bid for the given tokens within a single contract
     * @param contract
     * @param tokenIds
     */
    static getTokensTopBid(contract: string, tokenIds: string[]): Promise<{
        contract: string | null;
        tokenId: any;
        orderId: any;
        value: any;
        maker: string | null;
    }[]>;
    /**
     * Get top bids for tokens within multiple contracts, this is not the most efficient query, if the intention is to get
     * top bid for tokens which are all in the same contract, better to use getTokensTopBid
     * @param tokens
     */
    static getMultipleContractsTokensTopBid(tokens: {
        contract: string;
        tokenId: string;
    }[]): Promise<{
        contract: string | null;
        tokenId: any;
        orderId: any;
        value: any;
        maker: string | null;
    }[]>;
    /**
     * Get top bid for the given token set
     * @param tokenSetId
     */
    static getTokenSetTopBid(tokenSetId: string): Promise<{
        contract: string;
        tokenId: any;
        orderId: any;
        value: any;
        maker: string;
    }[]>;
}
//# sourceMappingURL=index.d.ts.map