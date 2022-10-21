"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.save = void 0;
const db_1 = require("@/common/db");
const logger_1 = require("@/common/logger");
const utils_1 = require("@/common/utils");
const index_1 = require("@/config/index");
const lodash_1 = __importDefault(require("lodash"));
const isValid = (tokenSet) => {
    try {
        if (tokenSet.id !== `contract:${tokenSet.contract}`) {
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
            throw new Error("Invalid token set");
        }
        const { id, schemaHash, schema, contract } = tokenSet;
        try {
            // Make sure an associated collection exists
            const collectionResult = await db_1.idb.oneOrNone(`
          SELECT
            collections.id,
            collections.token_count
          FROM collections
          WHERE collections.id = $/id/
        `, {
                id: contract,
            });
            if (!collectionResult || Number(collectionResult.token_count) > index_1.config.maxTokenSetSize) {
                // We don't support collection orders on large collections
                throw new Error("Collection missing or too large");
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
            )
            ON CONFLICT DO NOTHING
          `,
                    values: {
                        tokenSetId: tokenSet.id,
                        contract: (0, utils_1.toBuffer)(contract),
                    },
                });
            }
            valid.push(tokenSet);
        }
        catch (error) {
            logger_1.logger.info("orderbook-contract-wide-set", `Failed to check/save token set ${JSON.stringify(tokenSet)}: ${error}`);
        }
    }
    if (queries.length) {
        await db_1.idb.none(db_1.pgp.helpers.concat(queries));
    }
    if (lodash_1.default.isEmpty(valid)) {
        return [
            {
                id: "",
                schemaHash: "",
                contract: "",
            },
        ];
    }
    return valid;
};
exports.save = save;
//# sourceMappingURL=contract-wide.js.map