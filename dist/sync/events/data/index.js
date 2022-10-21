"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEventData = void 0;
const erc721 = __importStar(require("@/events-sync/data/erc721"));
const erc1155 = __importStar(require("@/events-sync/data/erc1155"));
const weth = __importStar(require("@/events-sync/data/weth"));
const blur = __importStar(require("@/events-sync/data/blur"));
const cryptoPunks = __importStar(require("@/events-sync/data/cryptopunks"));
const element = __importStar(require("@/events-sync/data/element"));
const foundation = __importStar(require("@/events-sync/data/foundation"));
const looksRare = __importStar(require("@/events-sync/data/looks-rare"));
const nftx = __importStar(require("@/events-sync/data/nftx"));
const nouns = __importStar(require("@/events-sync/data/nouns"));
const quixotic = __importStar(require("@/events-sync/data/quixotic"));
const rarible = __importStar(require("@/events-sync/data/rarible"));
const seaport = __importStar(require("@/events-sync/data/seaport"));
const sudoswap = __importStar(require("@/events-sync/data/sudoswap"));
const universe = __importStar(require("@/events-sync/data/universe"));
const wyvernV2 = __importStar(require("@/events-sync/data/wyvern-v2"));
const wyvernV23 = __importStar(require("@/events-sync/data/wyvern-v2.3"));
const x2y2 = __importStar(require("@/events-sync/data/x2y2"));
const zeroExV4 = __importStar(require("@/events-sync/data/zeroex-v4"));
const zora = __importStar(require("@/events-sync/data/zora"));
const getEventData = (eventDataKinds) => {
    if (!eventDataKinds) {
        return [
            erc721.transfer,
            erc721.approvalForAll,
            erc1155.transferSingle,
            erc1155.transferBatch,
            weth.approval,
            weth.transfer,
            weth.deposit,
            weth.withdrawal,
            foundation.buyPriceAccepted,
            foundation.buyPriceCancelled,
            foundation.buyPriceInvalidated,
            foundation.buyPriceSet,
            looksRare.cancelAllOrders,
            looksRare.cancelMultipleOrders,
            looksRare.takerAsk,
            looksRare.takerBid,
            seaport.counterIncremented,
            seaport.orderCancelled,
            seaport.orderFulfilled,
            wyvernV2.ordersMatched,
            wyvernV23.ordersMatched,
            zeroExV4.erc721OrderCancelled,
            zeroExV4.erc1155OrderCancelled,
            zeroExV4.erc721OrderFilled,
            zeroExV4.erc1155OrderFilled,
            x2y2.orderCancelled,
            x2y2.orderInventory,
            rarible.match,
            element.erc721BuyOrderFilled,
            element.erc721SellOrderFilled,
            element.erc1155BuyOrderFilled,
            element.erc1155SellOrderFilled,
            quixotic.orderFulfilled,
            zora.askFilled,
            zora.askCreated,
            zora.askCancelled,
            zora.askPriceUpdated,
            zora.auctionEnded,
            nouns.auctionSettled,
            cryptoPunks.punkOffered,
            cryptoPunks.punkNoLongerForSale,
            cryptoPunks.punkBought,
            cryptoPunks.punkTransfer,
            cryptoPunks.assign,
            cryptoPunks.transfer,
            sudoswap.buy,
            sudoswap.sell,
            sudoswap.tokenDeposit,
            sudoswap.tokenWithdrawal,
            universe.match,
            universe.cancel,
            nftx.minted,
            nftx.redeemed,
            blur.ordersMatched,
        ];
    }
    else {
        return (eventDataKinds
            .map(internalGetEventData)
            .filter(Boolean)
            // Force TS to remove `undefined`
            .map((x) => x));
    }
};
exports.getEventData = getEventData;
const internalGetEventData = (kind) => {
    switch (kind) {
        case "erc721-transfer":
            return erc721.transfer;
        case "erc721/1155-approval-for-all":
            return erc721.approvalForAll;
        case "erc1155-transfer-batch":
            return erc1155.transferBatch;
        case "erc1155-transfer-single":
            return erc1155.transferSingle;
        case "erc20-approval":
            return weth.approval;
        case "erc20-transfer":
            return weth.transfer;
        case "weth-deposit":
            return weth.deposit;
        case "weth-withdrawal":
            return weth.withdrawal;
        case "foundation-buy-price-accepted":
            return foundation.buyPriceAccepted;
        case "foundation-buy-price-cancelled":
            return foundation.buyPriceCancelled;
        case "foundation-buy-price-invalidated":
            return foundation.buyPriceInvalidated;
        case "foundation-buy-price-set":
            return foundation.buyPriceSet;
        case "wyvern-v2-orders-matched":
            return wyvernV2.ordersMatched;
        case "wyvern-v2.3-orders-matched":
            return wyvernV23.ordersMatched;
        case "looks-rare-cancel-all-orders":
            return looksRare.cancelAllOrders;
        case "looks-rare-cancel-multiple-orders":
            return looksRare.cancelMultipleOrders;
        case "looks-rare-taker-ask":
            return looksRare.takerAsk;
        case "looks-rare-taker-bid":
            return looksRare.takerBid;
        case "zeroex-v4-erc721-order-cancelled":
            return zeroExV4.erc721OrderCancelled;
        case "zeroex-v4-erc1155-order-cancelled":
            return zeroExV4.erc1155OrderCancelled;
        case "zeroex-v4-erc721-order-filled":
            return zeroExV4.erc721OrderFilled;
        case "zeroex-v4-erc1155-order-filled":
            return zeroExV4.erc1155OrderFilled;
        case "x2y2-order-cancelled":
            return x2y2.orderCancelled;
        case "x2y2-order-inventory":
            return x2y2.orderInventory;
        case "seaport-counter-incremented":
            return seaport.counterIncremented;
        case "seaport-order-cancelled":
            return seaport.orderCancelled;
        case "seaport-order-filled":
            return seaport.orderFulfilled;
        case "rarible-match":
            return rarible.match;
        case "element-erc721-sell-order-filled":
            return element.erc721SellOrderFilled;
        case "element-erc721-buy-order-filled":
            return element.erc721BuyOrderFilled;
        case "element-erc1155-sell-order-filled":
            return element.erc1155SellOrderFilled;
        case "element-erc1155-buy-order-filled":
            return element.erc1155BuyOrderFilled;
        case "quixotic-order-filled":
            return quixotic.orderFulfilled;
        case "zora-ask-filled":
            return zora.askFilled;
        case "zora-ask-created":
            return zora.askCreated;
        case "zora-ask-cancelled":
            return zora.askCancelled;
        case "zora-ask-price-updated":
            return zora.askPriceUpdated;
        case "zora-auction-ended":
            return zora.auctionEnded;
        case "nouns-auction-settled":
            return nouns.auctionSettled;
        case "cryptopunks-punk-offered":
            return cryptoPunks.punkOffered;
        case "cryptopunks-punk-no-longer-for-sale":
            return cryptoPunks.punkNoLongerForSale;
        case "cryptopunks-punk-bought":
            return cryptoPunks.punkBought;
        case "cryptopunks-punk-transfer":
            return cryptoPunks.punkTransfer;
        case "cryptopunks-assign":
            return cryptoPunks.assign;
        case "cryptopunks-transfer":
            return cryptoPunks.transfer;
        case "sudoswap-buy":
            return sudoswap.buy;
        case "sudoswap-sell":
            return sudoswap.sell;
        case "sudoswap-token-deposit":
            return sudoswap.tokenDeposit;
        case "sudoswap-token-withdrawal":
            return sudoswap.tokenWithdrawal;
        case "universe-match":
            return universe.match;
        case "universe-cancel":
            return universe.cancel;
        case "nftx-minted":
            return nftx.minted;
        case "nftx-redeemed":
            return nftx.redeemed;
        case "blur-orders-matched":
            return blur.ordersMatched;
        default:
            return undefined;
    }
};
//# sourceMappingURL=index.js.map