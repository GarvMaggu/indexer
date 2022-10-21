"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMarketplaces = void 0;
const joi_1 = __importDefault(require("joi"));
const index_1 = require("@/config/index");
exports.getMarketplaces = {
    description: "Get supported marketplaces",
    tags: ["api", "x-admin"],
    timeout: {
        server: 10 * 1000,
    },
    plugins: {
        "hapi-swagger": {
            order: 7,
        },
    },
    response: {
        schema: joi_1.default.object({
            marketplaces: joi_1.default.array().items(joi_1.default.object({
                name: joi_1.default.string(),
                imageUrl: joi_1.default.string(),
                fee: joi_1.default.object({
                    bps: joi_1.default.number(),
                    percent: joi_1.default.number(),
                }),
                feeBps: joi_1.default.number(),
                orderbook: joi_1.default.string().allow(null),
                orderKind: joi_1.default.string().allow(null),
                listingEnabled: joi_1.default.boolean(),
            })),
        }).label(`getMarketplacesv1Resp`),
    },
    handler: async () => {
        const marketplaces = [
            {
                name: "Reservoir",
                imageUrl: "https://api.reservoir.tools/redirect/sources/reservoir/logo/v2",
                fee: {
                    percent: 0,
                    bps: 0,
                },
                feeBps: 0,
                orderbook: "reservoir",
                orderKind: "seaport",
                listingEnabled: true,
            },
            {
                name: "OpenSea",
                imageUrl: "https://api.reservoir.tools/redirect/sources/opensea/logo/v2",
                fee: {
                    percent: 2.5,
                    bps: 250,
                },
                feeBps: 0.025,
                orderbook: "opensea",
                orderKind: "seaport",
                listingEnabled: false,
            },
            {
                name: "LooksRare",
                imageUrl: "https://api.reservoir.tools/redirect/sources/looksrare/logo/v2",
                fee: {
                    percent: 2,
                    bps: 200,
                },
                feeBps: 0.02,
                orderbook: "looks-rare",
                orderKind: "looks-rare",
                listingEnabled: false,
            },
            {
                name: "X2Y2",
                imageUrl: "https://api.reservoir.tools/redirect/sources/x2y2/logo/v2",
                fee: {
                    percent: 0.5,
                    bps: 50,
                },
                feeBps: 0.005,
                orderbook: "x2y2",
                orderKind: "x2y2",
                listingEnabled: false,
            },
            {
                name: "Foundation",
                imageUrl: "https://api.reservoir.tools/redirect/sources/foundation/logo/v2",
                fee: {
                    percent: 5,
                    bps: 500,
                },
                feeBps: 0.05,
                orderbook: null,
                orderKind: null,
                listingEnabled: false,
            },
        ];
        marketplaces.forEach((marketplace) => {
            let listableOrderbooks = ["reservoir"];
            switch (index_1.config.chainId) {
                case 1: {
                    listableOrderbooks = ["reservoir", "opensea", "looks-rare", "x2y2"];
                    break;
                }
                case 4: {
                    listableOrderbooks = ["reservoir", "opensea", "looks-rare"];
                    break;
                }
                case 5: {
                    listableOrderbooks = ["reservoir", "opensea", "looks-rare"];
                    break;
                }
            }
            marketplace.listingEnabled =
                marketplace.orderbook && listableOrderbooks.includes(marketplace.orderbook) ? true : false;
        });
        return {
            marketplaces: marketplaces,
        };
    },
};
//# sourceMappingURL=get-marketplaces.js.map