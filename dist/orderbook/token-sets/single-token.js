"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.save = void 0;
const db_1 = require("@/common/db");
const logger_1 = require("@/common/logger");
const utils_1 = require("@/common/utils");
const isValid = (tokenSet) => {
    try {
        if (tokenSet.id !== `token:${tokenSet.contract}:${tokenSet.tokenId}`) {
            return false;
        }
    }
    catch {
        return false;
    }
    return true;
};
const save = async (tokenSets) => {
    const queries = [];
    const valid = [];
    for (const tokenSet of tokenSets) {
        if (!isValid(tokenSet)) {
            continue;
        }
        const { id, schemaHash, schema, contract, tokenId } = tokenSet;
        try {
            queries.push({
                query: `
          INSERT INTO "token_sets" (
            "id",
            "schema_hash",
            "schema"
          ) VALUES (
            $/id/,
            $/schemaHash/,
            $/schema:json/
          )
          ON CONFLICT DO NOTHING
        `,
                values: {
                    id,
                    schemaHash: (0, utils_1.toBuffer)(schemaHash),
                    schema,
                },
            });
            queries.push({
                query: `
          INSERT INTO "token_sets_tokens" (
            "token_set_id",
            "contract",
            "token_id"
          ) VALUES (
            $/tokenSetId/,
            $/contract/,
            $/tokenId/
          )
          ON CONFLICT DO NOTHING
        `,
                values: {
                    tokenSetId: tokenSet.id,
                    contract: (0, utils_1.toBuffer)(contract),
                    tokenId,
                },
            });
            valid.push(tokenSet);
        }
        catch (error) {
            logger_1.logger.error("orderbook-single-token-set", `Failed to check/save token set ${JSON.stringify(tokenSet)}: ${error}`);
        }
    }
    if (queries.length) {
        await db_1.idb.none(db_1.pgp.helpers.concat(queries));
    }
    return valid;
};
exports.save = save;
//# sourceMappingURL=single-token.js.map