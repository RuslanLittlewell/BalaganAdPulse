import { z } from "zod";
import type { RouteDoc } from "#shared/presentation/openapi.js";
import { SUMMARY_TILES } from "#modules/summary-tiles/domain/summary-tiles.js";
import { summaryTilesSchema } from "./summary-tile-schemas.js";

const chosen = z.object({ tiles: z.array(z.enum(SUMMARY_TILES)) });

export const summaryTileDoc: RouteDoc = {
  tag: "Summary tiles",
  tagDescription:
    "The tiles a period summary shows, in catalogue order. The dashboard's belong to each member alone; a project's are shared by everyone who opens the project or its campaigns, and only admins and managers choose them.",
  operations: [
    {
      method: "get",
      path: "/dashboard/summary-tiles",
      summary: "Read the caller's own dashboard tiles",
      success: { status: 200, description: "The caller's tiles", schema: chosen },
      errors: [401],
    },
    {
      method: "put",
      path: "/dashboard/summary-tiles",
      summary: "Replace the caller's own dashboard tiles",
      body: summaryTilesSchema,
      success: { status: 200, description: "The stored tiles", schema: chosen },
      errors: [400, 401],
    },
    {
      method: "get",
      path: "/projects/:id/summary-tiles",
      summary: "Read a project's tiles",
      success: { status: 200, description: "The project's tiles", schema: chosen },
      errors: [401, 404],
    },
    {
      method: "put",
      path: "/projects/:id/summary-tiles",
      summary: "Replace a project's tiles for everyone who opens it",
      body: summaryTilesSchema,
      success: { status: 200, description: "The stored tiles", schema: chosen },
      errors: [400, 401, 403, 404],
    },
  ],
};
