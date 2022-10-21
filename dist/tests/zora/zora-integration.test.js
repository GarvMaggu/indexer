"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = require("dotenv");
(0, dotenv_1.config)();
const provider_1 = require("@/common/provider");
const test_1 = require("../utils/test");
const solidity_1 = require("@ethersproject/solidity");
const abi_1 = require("@ethersproject/abi");
const contracts_1 = require("@ethersproject/contracts");
const wallet_1 = require("@ethersproject/wallet");
const sdk_1 = require("@reservoir0x/sdk");
const index_1 = require("@/config/index");
const units_1 = require("@ethersproject/units");
const ethers_1 = require("ethers");
const db_1 = require("@/common/db");
const test_accounts_1 = require("./__fixtures__/test-accounts");
// import { toBuffer } from "@/common/utils";
const operatorProvider = new wallet_1.Wallet(test_accounts_1.operatorKey, provider_1.baseProvider);
const operator2Provider = new wallet_1.Wallet(test_accounts_1.operator2Key, provider_1.baseProvider);
jest.setTimeout(600 * 1000);
describe("ZoraTestnet", () => {
    const tokenId = 1;
    const chainId = index_1.config.chainId;
    // test NFT contract
    const nftToken = new contracts_1.Contract(test_accounts_1.testNFTAddr, new abi_1.Interface([
        "function safeMint(address to) public",
        "function balanceOf(address owner) public view returns(uint256)",
        "function ownerOf(uint256 _tokenId) external view returns (address)",
        "function setApprovalForAll(address _operator, bool _approved) external",
        "function transferFrom(address _from, address _to, uint256 _tokenId) external payable",
        "function isApprovedForAll(address _owner, address _operator) external view returns (bool)",
    ]), operatorProvider);
    const indexInterval = 40 * 1000;
    const orderId = (0, solidity_1.keccak256)(["string", "string", "uint256"], ["zora-v3", `${test_accounts_1.testNFTAddr}`, `${tokenId}`]);
    test("create-order", async () => {
        const seller = operatorProvider;
        const balance = await nftToken.balanceOf(test_accounts_1.operator);
        const currentOwner = await nftToken.ownerOf(tokenId);
        // send back NFT
        if (currentOwner === test_accounts_1.operator2) {
            const backTx = await nftToken
                .connect(operator2Provider)
                .transferFrom(operator2Provider.address, operatorProvider.address, tokenId);
            await backTx.wait();
        }
        if (balance.toString() === "0") {
            const tx = await nftToken.safeMint(test_accounts_1.operator);
            await tx.wait();
        }
        const exchange = new sdk_1.Zora.Exchange(chainId);
        const moduleManager = new sdk_1.Zora.ModuleManager(chainId);
        // Approve the exchange for escrowing.
        const isApproved = await nftToken.isApprovedForAll(seller.address, sdk_1.Zora.Addresses.Erc721TransferHelper[chainId]);
        if (!isApproved) {
            await moduleManager.setApprovalForModule(seller, sdk_1.Zora.Addresses.Exchange[chainId], true);
            const tx = await nftToken.setApprovalForAll(sdk_1.Zora.Addresses.Erc721TransferHelper[chainId], true);
            await tx.wait();
        }
        const owner = await nftToken.ownerOf(tokenId);
        expect(owner).toEqual(seller.address);
        const price = (0, units_1.parseEther)("0.005");
        // Create sell order.
        const order = new sdk_1.Zora.Order(chainId, {
            tokenContract: test_accounts_1.testNFTAddr,
            tokenId,
            askPrice: price.toString(),
            askCurrency: ethers_1.ethers.constants.AddressZero,
            sellerFundsRecipient: seller.address,
            findersFeeBps: 0,
        });
        const creatTx = await exchange.createOrder(seller, order);
        await creatTx.wait();
        await (0, test_1.wait)(indexInterval);
        const dbOrder = await db_1.idb.oneOrNone(`SELECT fillability_status FROM "orders" "o" WHERE "o"."id" = $/id/`, {
            id: orderId,
        });
        expect(dbOrder === null || dbOrder === void 0 ? void 0 : dbOrder.fillability_status).toEqual("fillable");
    });
    test("balance-change", async () => {
        // const nftBalance1 = await idb.oneOrNone(
        //   `SELECT amount FROM "nft_balances" "o" WHERE "o"."owner" = $/maker/`,
        //   {
        //     id: orderId,
        //     maker: toBuffer(operatorProvider.address),
        //     contract: toBuffer(testNFTAddr),
        //     tokenId: tokenId,
        //   }
        // );
        // console.log("nftBalance1", nftBalance1);
        const tokenOwner = await nftToken.ownerOf(tokenId);
        const indexInterval = 40 * 1000;
        if (tokenOwner == operatorProvider.address) {
            const tx = await nftToken
                .connect(operatorProvider)
                .transferFrom(operatorProvider.address, operator2Provider.address, tokenId);
            await tx.wait();
            await (0, test_1.wait)(indexInterval);
        }
        // const nftBalance = await idb.oneOrNone(
        //   `SELECT amount FROM "nft_balances" "o" WHERE "o"."owner" = $/maker/`,
        //   {
        //     id: orderId,
        //     maker: toBuffer(operatorProvider.address),
        //     contract: toBuffer(testNFTAddr),
        //     tokenId: tokenId,
        //   }
        // );
        // console.log("nftBalance", nftBalance);
        const order = await db_1.idb.oneOrNone(`SELECT fillability_status FROM "orders" "o" WHERE "o"."id" = $/id/`, {
            id: orderId,
        });
        const backTx = await nftToken
            .connect(operator2Provider)
            .transferFrom(operator2Provider.address, operatorProvider.address, tokenId);
        await backTx.wait();
        await (0, test_1.wait)(indexInterval);
        const orderAfter = await db_1.idb.oneOrNone(`SELECT fillability_status FROM "orders" "o" WHERE "o"."id" = $/id/`, {
            id: orderId,
        });
        // const nftBalance2 = await idb.oneOrNone(
        //   `SELECT amount FROM "nft_balances" "o" WHERE "o"."owner" = $/maker/`,
        //   {
        //     id: orderId,
        //     maker: toBuffer(operatorProvider.address),
        //     contract: toBuffer(testNFTAddr),
        //     tokenId: tokenId,
        //   }
        // );
        expect(order === null || order === void 0 ? void 0 : order.fillability_status).toEqual("no-balance");
        expect(orderAfter === null || orderAfter === void 0 ? void 0 : orderAfter.fillability_status).toEqual("fillable");
    });
    test("approval-change", async () => {
        const indexInterval = 30 * 1000;
        const cancelTx = await nftToken
            .connect(operatorProvider)
            .setApprovalForAll(sdk_1.Zora.Addresses.Erc721TransferHelper[chainId], false);
        await cancelTx.wait();
        await (0, test_1.wait)(indexInterval);
        const order = await db_1.idb.oneOrNone(`SELECT fillability_status, approval_status FROM "orders" "o" WHERE "o"."id" = $/id/`, {
            id: orderId,
        });
        const approvalTx = await nftToken
            .connect(operatorProvider)
            .setApprovalForAll(sdk_1.Zora.Addresses.Erc721TransferHelper[chainId], true);
        await approvalTx.wait();
        await (0, test_1.wait)(indexInterval);
        const orderAfter = await db_1.idb.oneOrNone(`SELECT fillability_status, approval_status FROM "orders" "o" WHERE "o"."id" = $/id/`, {
            id: orderId,
        });
        expect(order === null || order === void 0 ? void 0 : order.approval_status).toEqual("no-approval");
        expect(orderAfter === null || orderAfter === void 0 ? void 0 : orderAfter.approval_status).toEqual("approved");
    });
    test("cancel-order", async () => {
        const seller = operatorProvider;
        const order = new sdk_1.Zora.Order(chainId, {
            tokenContract: test_accounts_1.testNFTAddr,
            tokenId,
            askPrice: "0",
            askCurrency: ethers_1.ethers.constants.AddressZero,
            sellerFundsRecipient: seller.address,
            findersFeeBps: 0,
        });
        const exchange = new sdk_1.Zora.Exchange(chainId);
        const cancelTxt = await exchange.cancelOrder(seller, order);
        await cancelTxt.wait();
        await (0, test_1.wait)(indexInterval);
        const dbOrder = await db_1.idb.oneOrNone(`SELECT fillability_status, approval_status FROM "orders" "o" WHERE "o"."id" = $/id/`, {
            id: orderId,
        });
        // console.log("dbOrder", dbOrder);
        expect(dbOrder === null || dbOrder === void 0 ? void 0 : dbOrder.fillability_status).toEqual("cancelled");
    });
    test("update-order", async () => {
        const price = (0, units_1.parseEther)("0.002");
        const order = new sdk_1.Zora.Order(chainId, {
            tokenContract: test_accounts_1.testNFTAddr,
            tokenId,
            askPrice: price.toString(),
            askCurrency: ethers_1.ethers.constants.AddressZero,
            sellerFundsRecipient: operatorProvider.address,
            findersFeeBps: 0,
        });
        const exchange = new sdk_1.Zora.Exchange(chainId);
        const updateTx = await operatorProvider.sendTransaction({
            from: operatorProvider.address,
            to: exchange.contract.address,
            data: exchange.contract.interface.encodeFunctionData("setAskPrice", [
                order.params.tokenContract,
                order.params.tokenId,
                order.params.askPrice,
                order.params.askCurrency,
            ]),
        });
        await updateTx.wait();
        await (0, test_1.wait)(indexInterval);
        const dbOrder = await db_1.idb.oneOrNone(`SELECT fillability_status, approval_status, price FROM "orders" "o" WHERE "o"."id" = $/id/`, {
            id: orderId,
        });
        // console.log("dbOrder", dbOrder)
        expect(dbOrder === null || dbOrder === void 0 ? void 0 : dbOrder.price).toEqual(price.toString());
    });
    test("update-order-invalid-currency", async () => {
        const price = (0, units_1.parseEther)("0.002");
        const order = new sdk_1.Zora.Order(chainId, {
            tokenContract: test_accounts_1.testNFTAddr,
            tokenId,
            askPrice: price.toString(),
            // askCurrency: ethers.constants.AddressZero,
            askCurrency: "0x5ffbac75efc9547fbc822166fed19b05cd5890bb",
            sellerFundsRecipient: operatorProvider.address,
            findersFeeBps: 0,
        });
        const exchange = new sdk_1.Zora.Exchange(chainId);
        const updateTx = await operatorProvider.sendTransaction({
            from: operatorProvider.address,
            to: exchange.contract.address,
            data: exchange.contract.interface.encodeFunctionData("setAskPrice", [
                order.params.tokenContract,
                order.params.tokenId,
                order.params.askPrice,
                order.params.askCurrency,
            ]),
        });
        await updateTx.wait();
        await (0, test_1.wait)(indexInterval);
        const dbOrder = await db_1.idb.oneOrNone(`SELECT fillability_status, approval_status, price FROM "orders" "o" WHERE "o"."id" = $/id/`, {
            id: orderId,
        });
        // console.log("dbOrder", dbOrder)
        expect(dbOrder === null || dbOrder === void 0 ? void 0 : dbOrder.fillability_status).toEqual("cancelled");
    });
    test("fill-order", async () => {
        const price = (0, units_1.parseEther)("0.002");
        const order = new sdk_1.Zora.Order(chainId, {
            tokenContract: test_accounts_1.testNFTAddr,
            tokenId,
            askPrice: price.toString(),
            askCurrency: ethers_1.ethers.constants.AddressZero,
            sellerFundsRecipient: operatorProvider.address,
            findersFeeBps: 0,
        });
        const exchange = new sdk_1.Zora.Exchange(chainId);
        await exchange.fillOrder(operator2Provider, order);
        await (0, test_1.wait)(indexInterval);
        const dbOrder = await db_1.idb.oneOrNone(`SELECT fillability_status, approval_status, price FROM "orders" "o" WHERE "o"."id" = $/id/`, {
            id: orderId,
        });
        // console.log("dbOrder", dbOrder)
        expect(dbOrder === null || dbOrder === void 0 ? void 0 : dbOrder.fillability_status).toEqual("filled");
    });
});
//# sourceMappingURL=zora-integration.test.js.map