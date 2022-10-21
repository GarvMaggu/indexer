"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = require("dotenv");
(0, dotenv_1.config)();
const provider_1 = require("@/common/provider");
const tx_1 = __importDefault(require("./__fixtures__/tx"));
const db_1 = require("@/common/db");
const test_1 = require("../utils/test");
const zora_1 = require("@/events-sync/handlers/zora");
const utils_1 = require("@/events-sync/handlers/utils");
const solidity_1 = require("@ethersproject/solidity");
describe("ZoraExchange", () => {
    test("order", async () => {
        var _a;
        const tx = await provider_1.baseProvider.getTransactionReceipt(tx_1.default.createAskTx);
        const events = await (0, test_1.getEventsFromTx)(tx);
        const result = await (0, zora_1.handleEvents)(events);
        expect((_a = result.orders) === null || _a === void 0 ? void 0 : _a.length).toEqual(1);
    });
    test("order-save-cancel", async () => {
        const groupCreateTx = await provider_1.baseProvider.getTransactionReceipt(tx_1.default.cancelAskCreateTx);
        const cancelAsk = await provider_1.baseProvider.getTransactionReceipt(tx_1.default.cancelAskTx);
        const createEvents = await (0, test_1.getEventsFromTx)(groupCreateTx);
        const cancelEvents = await (0, test_1.getEventsFromTx)(cancelAsk);
        const createResult = await (0, zora_1.handleEvents)(createEvents);
        const cancelAskResult = await (0, zora_1.handleEvents)(cancelEvents);
        // if (createResult.orders?.length) console.log(createResult.orders[0])
        // console.log(cancelAskResult.cancelEventsOnChain)
        await (0, utils_1.processOnChainData)(createResult);
        await (0, test_1.wait)(10 * 1000);
        await (0, utils_1.processOnChainData)(cancelAskResult);
        await (0, test_1.wait)(10 * 1000);
        const orderId = (0, solidity_1.keccak256)(["string", "string", "uint256"], ["zora-v3", "0x2E6847e41c1193FE9528FA53c50e16C9fD082219", "3"]);
        const [order, cancelExist] = await Promise.all([
            db_1.idb.oneOrNone(`SELECT fillability_status FROM "orders" "o" WHERE "o"."id" = $/id/`, {
                id: orderId,
            }),
            db_1.idb.oneOrNone(`SELECT 1 FROM "cancel_events" "o" WHERE "o"."order_id" = $/id/`, {
                id: orderId,
            }),
        ]);
        expect(order === null || order === void 0 ? void 0 : order.fillability_status).toEqual("cancelled");
        expect(!!cancelExist).toEqual(true);
    });
    test("order-update", async () => {
        const setAskCreateTx = await provider_1.baseProvider.getTransactionReceipt(tx_1.default.setAskCreateTx);
        const setAskTx = await provider_1.baseProvider.getTransactionReceipt(tx_1.default.setAskTx);
        const eventsCreate = await (0, test_1.getEventsFromTx)(setAskCreateTx);
        const eventsSet = await (0, test_1.getEventsFromTx)(setAskTx);
        const result1 = await (0, zora_1.handleEvents)(eventsCreate);
        const result2 = await (0, zora_1.handleEvents)(eventsSet);
        await (0, utils_1.processOnChainData)(result1);
        await (0, test_1.wait)(10 * 1000);
        await (0, utils_1.processOnChainData)(result2);
        await (0, test_1.wait)(10 * 1000);
        const orderId = (0, solidity_1.keccak256)(["string", "string", "uint256"], ["zora-v3", "0xabEFBc9fD2F806065b4f3C237d4b59D9A97Bcac7", "10042"]);
        const order = await db_1.idb.oneOrNone(`SELECT price FROM "orders" "o" WHERE "o"."id" = $/id/`, {
            id: orderId,
        });
        // after update
        expect(order === null || order === void 0 ? void 0 : order.price).toEqual("990000000000000000");
    });
});
//# sourceMappingURL=zora.test.js.map