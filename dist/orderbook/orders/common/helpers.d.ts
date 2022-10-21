import { BigNumber } from "@ethersproject/bignumber";
import { OrderKind } from "@/orderbook/orders";
export declare const getContractKind: (contract: string) => Promise<"erc721" | "erc1155" | undefined>;
export declare const getRoyalties: (collection: string) => Promise<{
    bps: number;
    recipient: string;
}[]>;
export declare const getFtBalance: (contract: string, owner: string) => Promise<BigNumber>;
export declare const getNftBalance: (contract: string, tokenId: string, owner: string) => Promise<BigNumber>;
export declare const getNftApproval: (contract: string, owner: string, operator: string) => Promise<boolean>;
export declare const getMinNonce: (orderKind: OrderKind, maker: string) => Promise<BigNumber>;
export declare const isNonceCancelled: (orderKind: OrderKind, maker: string, nonce: string) => Promise<boolean>;
export declare const isOrderCancelled: (orderId: string) => Promise<boolean>;
export declare const getQuantityFilled: (orderId: string) => Promise<BigNumber>;
//# sourceMappingURL=helpers.d.ts.map