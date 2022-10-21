import Joi from "joi";
import { Currency } from "@/utils/currencies";
export declare const JoiPrice: Joi.ObjectSchema<any>;
export declare const getJoiAmountObject: (currency: Currency, amount: string, nativeAmount: string, usdAmount?: string | undefined) => Promise<{
    raw: string;
    decimal: number;
    usd: number | null;
    native: number;
}>;
export declare const getJoiPriceObject: (prices: {
    gross: {
        amount: string;
        nativeAmount: string;
        usdAmount?: string;
    };
    net?: {
        amount: string;
        nativeAmount: string;
        usdAmount?: string;
    };
}, currencyAddress: string) => Promise<{
    currency: {
        contract: string;
        name: string | undefined;
        symbol: string | undefined;
        decimals: number | undefined;
    };
    amount: {
        raw: string;
        decimal: number;
        usd: number | null;
        native: number;
    };
    netAmount: {
        raw: string;
        decimal: number;
        usd: number | null;
        native: number;
    } | undefined;
}>;
//# sourceMappingURL=joi.d.ts.map