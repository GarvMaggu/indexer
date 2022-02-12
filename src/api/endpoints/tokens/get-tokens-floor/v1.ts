import { Request, RouteOptions } from "@hapi/hapi";
import Joi from "joi";

import { db } from "@/common/db";
import { logger } from "@/common/logger";
import { formatEth, toBuffer } from "@/common/utils";

const version = "v1";

export const getTokensFloorV1Options: RouteOptions = {
  description: "Get the list of floor prices for a collection or contract.",
  tags: ["api", "tokens"],
  validate: {
    query: Joi.object({
      collection: Joi.string(),
      contract: Joi.string()
        .lowercase()
        .pattern(/^0x[a-f0-9]{40}$/),
    })
      .or("collection", "contract")
      .oxor("collection", "contract"),
  },
  response: {
    schema: Joi.object({
      tokens: Joi.object().pattern(/^[0-9]+$/, Joi.number().unsafe()),
    }).label(`getTokensFloor${version.toUpperCase()}Response`),
    failAction: (_request, _h, error) => {
      logger.error(
        `get-tokens-floor-${version}-handler`,
        `Wrong response schema: ${error}`
      );
      throw error;
    },
  },
  handler: async (request: Request) => {
    const query = request.query as any;

    try {
      let baseQuery = `
        SELECT
          "t"."token_id",
          "t"."floor_sell_value"
        FROM "tokens" "t"
      `;

      // Filters
      const conditions: string[] = [`"t"."floor_sell_value" IS NOT NULL`];
      if (query.collection) {
        conditions.push(`"t"."collection_id" = $/collection/`);
      }
      if (query.contract) {
        (query as any).contract = toBuffer(query.contract);
        conditions.push(`"t"."contract" = $/contract/`);
      }
      if (conditions.length) {
        baseQuery += " WHERE " + conditions.map((c) => `(${c})`).join(" AND ");
      }

      const result = await db
        .manyOrNone(baseQuery, query)
        .then((result) =>
          Object.fromEntries(
            result.map((r) => [r.token_id, formatEth(r.floor_sell_value)])
          )
        );

      return { tokens: result };
    } catch (error) {
      logger.error(
        `get-tokens-floor-${version}-handler`,
        `Handler failure: ${error}`
      );
      throw error;
    }
  },
};