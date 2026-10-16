import { z } from "zod";
import type { RouteDoc } from "#shared/presentation/openapi.js";
const metadata = z.object({ id: z.uuid(), provider: z.enum(["META"]), accountId: z.string(), currency: z.string(), timezone: z.string(), status: z.enum(["QUEUED", "RUNNING", "SUCCESS", "ERROR", "AUTH_REQUIRED"]), lastSuccessAt: z.iso.datetime().nullable(), lastError: z.string().nullable(), nextDailyAt: z.iso.datetime(), leadsEnabled: z.boolean(), leads: z.object({ status: z.enum(["WAITING", "OK", "ACCESS_REQUIRED", "ERROR"]), lastSuccessAt: z.iso.datetime().nullable(), lastError: z.string().nullable() }) }).nullable();
const credentials = z.object({ accountId: z.string().regex(/^(act_)?[0-9]{1,30}$/), token: z.string().min(1).max(8192).meta({ writeOnly: true }) });
export const integrationDoc: RouteDoc = {
  tag: "Meta integration",
  tagDescription: "Project editors connect one or more Meta accounts, import the last 30 completed account-local days, and refresh at 08:00 Europe/Warsaw. Tokens are write-only.",
  operations: [
    { method: "get", path: "/:id/integrations", summary: "List the project's connections and their import status", success: { status: 200, description: "Safe connection metadata, oldest first", schema: z.array(metadata) }, errors: [401, 403, 404] },
    { method: "post", path: "/:id/integrations/meta", summary: "Verify and add a Meta connection; queue its initial import", body: credentials.extend({ leadsEnabled: z.boolean().optional() }), success: { status: 201, description: "Saved connection; token is never returned", schema: metadata }, errors: [400, 401, 403, 404, 409] },
    { method: "put", path: "/:id/integrations/:integrationId", summary: "Verify and replace a connection's credentials; queue an import", body: credentials, success: { status: 200, description: "Saved connection; token is never returned", schema: metadata }, errors: [400, 401, 403, 404, 409] },
    { method: "patch", path: "/:id/integrations/:integrationId", summary: "Switch a connection's lead import on or off", body: z.object({ leadsEnabled: z.boolean() }), success: { status: 200, description: "Updated connection", schema: metadata }, errors: [400, 401, 403, 404] },
    { method: "delete", path: "/:id/integrations/:integrationId", summary: "Erase one connection and cancel its work while preserving imported data", success: { status: 204, description: "Disconnected" }, errors: [401, 403, 404] },
    { method: "post", path: "/:id/integrations/:integrationId/sync", summary: "Queue a manual refresh of one connection, coalescing concurrent requests", success: { status: 202, description: "Current import status", schema: metadata }, errors: [401, 403, 404] },
  ],
};
export const adPreviewDoc: RouteDoc = {
  tag: "Meta integration",
  operations: [
    {
      method: "get",
      path: "/:id/creatives",
      summary: "Fetch and store one ad's creatives on first view",
      success: {
        status: 200,
        description: "Stored creative metadata, without storage or provider URLs",
        schema: z.array(z.object({
          id: z.uuid(),
          position: z.int(),
          kind: z.enum(["IMAGE", "VIDEO"]),
          title: z.string().nullable(),
          body: z.string().nullable(),
          hasFile: z.boolean(),
          hasPoster: z.boolean(),
        })),
      },
      errors: [401, 404],
    },
    { method: "get", path: "/:id/preview", summary: "Read the provider's rendered preview of one ad", success: { status: 200, description: "A short-lived frame address rendering the ad", schema: z.object({ url: z.url() }) }, errors: [401, 404] },
  ],
};
