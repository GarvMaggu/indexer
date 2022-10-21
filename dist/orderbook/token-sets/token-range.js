"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.save = void 0;
const db_1 = require("@/common/db");
const logger_1 = require("@/common/logger");
const utils_1 = require("@/common/utils");
const utils_2 = require("@/orderbook/orders/utils");
const isValid = (tokenSet) => {
    try {
        if (tokenSet.id !== `range:${tokenSet.contract}:${tokenSet.startTokenId}:${tokenSet.endTokenId}`) {
            return false;
        }
        const schemaHash = (0, utils_2.generateSchemaHash)(tokenSet.schema);
        if (schemaHash !== tokenSet.schemaHash) {
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
        const { id, schemaHash, schema, contract, startTokenId, endTokenId } = tokenSet;
        try {
            // Make sure an associated collection exists
            const collectionResult = await db_1.idb.oneOrNone(`
          SELECT "id" FROM "collections"
          WHERE "id" = $/id/
        `, {
                id: `${contract}:${startTokenId}:${endTokenId}`,
            });
            if (!collectionResult) {
                continue;
            }
            queries.push({
                query: `
          INSERT INTO "token_sets" (
            "id",
            "schema_hash",
            "schema",
            "collection_id"
          ) VALUES (
            $/id/,
            $/schemaHash/,
            $/schema:json/,
            $/collection/
          )
          ON CONFLICT DO NOTHING
        `,
                values: {
                    id,
                    schemaHash: (0, utils_1.toBuffer)(schemaHash),
                    schema,
                    collection: collectionResult.id,
                },
            });
            // For efficiency, skip if data already exists
            const tokenSetTokensExist = await db_1.redb.oneOrNone(`
          SELECT 1 FROM "token_sets_tokens" "tst"
          WHERE "tst"."token_set_id" = $/tokenSetId/
          LIMIT 1
        `, { tokenSetId: id });
            if (!tokenSetTokensExist) {
                queries.push({
                    query: `
            INSERT INTO "token_sets_tokens" (
              "token_set_id",
              "contract",
              "token_id"
            ) (
              SELECT
                $/tokenSetId/,
                $/contract/,
                "t"."token_id"
              FROM "tokens" "t"
              WHERE "t"."contract" = $/contract/
                AND "t"."token_id" >= $/startTokenId/
                AND "t"."token_id" <= $/endTokenId/
            )
            ON CONFLICT DO NOTHING
          `,
                    values: {
                        tokenSetId: tokenSet.id,
                        contract: (0, utils_1.toBuffer)(contract),
                        startTokenId,
                        endTokenId,
                    },
                });
            }
            valid.push(tokenSet);
        }
        catch (error) {
            logger_1.logger.error("orderbook-token-range-set", `Failed to check/save token set ${JSON.stringify(tokenSet)}: ${error}`);
        }
    }
    if (queries.length) {
        await db_1.idb.none(db_1.pgp.helpers.concat(queries));
    }
    return valid;
};
exports.save = save;
//# sourceMappingURL=token-range.js.map