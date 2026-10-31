import { z } from "zod";
import { CHANNELS } from "#modules/campaigns/index.js";
import { MAX_SUMMARY_TILES, SUMMARY_TILES } from "#modules/summary-tiles/domain/summary-tiles.js";

export const summaryAccountSchema = z.object({
  channel: z.enum(CHANNELS),
  accountId: z.string().trim().min(1).max(100),
}).strict();

export const summaryTilesSchema = z.object({
  tiles: z.array(z.enum(SUMMARY_TILES))
    .max(MAX_SUMMARY_TILES, `A summary shows at most ${MAX_SUMMARY_TILES} tiles`)
    .refine((tiles) => new Set(tiles).size === tiles.length, "A tile may be chosen once"),
  account: summaryAccountSchema.nullable().default(null),
}).strict();
