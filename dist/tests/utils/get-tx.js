"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = require("dotenv");
(0, dotenv_1.config)();
const provider_1 = require("@/common/provider");
const args = process.argv.splice(2);
(async () => {
    const tx = await provider_1.baseProvider.getTransactionReceipt(args[0]);
    process.stdout.write(JSON.stringify(tx, null, 2));
})();
//# sourceMappingURL=get-tx.js.map