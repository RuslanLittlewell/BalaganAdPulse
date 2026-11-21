import { z } from "zod";
import type { RouteDoc } from "#shared/presentation/openapi.js";
import {
  changeConnectionSchema,
  connectSchema,
  connectionViewSchema,
  problemSchema,
  runSchema,
  runViewSchema,
  stageMappingSchema,
  stageSchema,
  statusSchema,
} from "./bitrix24-schemas.js";

export const bitrix24Doc: RouteDoc = {
  tag: "Bitrix24",
  tagDescription:
    "The organization's one Bitrix24 portal. An admin connects it with the portal's inbound webhook address and the application token of its outbound webhook, maps stages to statuses and moves existing records. The secrets are never returned.",
  operations: [
    { method: "get", path: "/connection", summary: "Read the connection", success: { status: 200, description: "The connection, or null", schema: connectionViewSchema.nullable() }, errors: [401, 403, 404] },
    { method: "post", path: "/connection", summary: "Connect a portal", body: connectSchema, success: { status: 201, description: "The new connection", schema: connectionViewSchema }, errors: [400, 401, 403, 404, 409, 503] },
    { method: "patch", path: "/connection", summary: "Change the connection", description: "Replaces the webhook address or the token, switches syncing on or off, or chooses the project for leads that start in Bitrix24.", body: changeConnectionSchema, success: { status: 200, description: "The changed connection", schema: connectionViewSchema }, errors: [400, 401, 403, 404, 503] },
    { method: "delete", path: "/connection", summary: "Remove the connection", description: "Forgets the secrets and the links between records. Records on both sides stay.", success: { status: 204, description: "Removed" }, errors: [401, 403, 404] },
    { method: "get", path: "/statuses", summary: "List the portal's lead statuses", success: { status: 200, description: "The statuses", schema: z.array(statusSchema) }, errors: [401, 403, 404, 503] },
    { method: "get", path: "/stages", summary: "List stages with their mapped status", success: { status: 200, description: "Fixed stages and board columns", schema: z.array(stageSchema) }, errors: [401, 403, 404] },
    { method: "put", path: "/stages", summary: "Map stages to statuses", body: stageMappingSchema, success: { status: 200, description: "The mapping", schema: z.array(stageSchema) }, errors: [400, 401, 403, 404] },
    { method: "get", path: "/problems", summary: "List skipped and failed changes", success: { status: 200, description: "The problems, newest first", schema: z.array(problemSchema) }, errors: [401, 403, 404] },
    { method: "post", path: "/runs", summary: "Start a one-time upload or download", body: runSchema, success: { status: 202, description: "The started run", schema: runViewSchema }, errors: [400, 401, 403, 404, 409] },
    { method: "get", path: "/runs/latest", summary: "Read the latest run", success: { status: 200, description: "The run, or null", schema: runViewSchema.nullable() }, errors: [401, 403, 404] },
  ],
};

export const bitrix24WebhookDoc: RouteDoc = {
  tag: "Bitrix24 webhook",
  tagDescription: "The address a portal's outbound webhook calls. The key names the connection and the application token proves the caller.",
  operations: [
    {
      method: "post",
      path: "/:key",
      summary: "Receive a Bitrix24 event",
      description: "Accepts the portal's form-encoded event. An unknown key and a wrong token answer the same 404.",
      open: true,
      success: { status: 202, description: "The event is stored" },
      errors: [404, 429],
    },
  ],
};
