"use strict";
// There are many processes we might want to execute in regards
// to token state changes. For example, we might want to handle
// burns in a special way or make sure the token will associate
// to a collection when it gets minted.
Object.defineProperty(exports, "__esModule", { value: true });
require("@/jobs/token-updates/mint-queue");
require("@/jobs/token-updates/token-refresh-cache");
require("@/jobs/token-updates/fetch-collection-metadata");
//# sourceMappingURL=index.js.map