import { z } from "zod";
import type { RouteDoc } from "#shared/presentation/openapi.js";
const metadata = z.object({ accountId: z.string(), currency: z.string(), timezone: z.string(), status: z.enum(["QUEUED", "RUNNING", "SUCCESS", "ERROR", "AUTH_REQUIRED"]), lastSuccessAt: z.iso.datetime().nullable(), lastError: z.string().nullable(), nextDailyAt: z.iso.datetime() }).nullable();
export const integrationDoc: RouteDoc = {
  tag: "Meta integration",
  tagDescription: "Project editors connect a Meta account, import the last 30 completed account-local days, and refresh at 08:00 Europe/Warsaw. Tokens are write-only.",
  operations: [
    { method: "get", path: "/:id/integrations/meta", summary: "Read connection and import status", success: { status: 200, description: "Safe connection metadata, or null if disconnected", schema: metadata }, errors: [401, 403, 404] },
    { method: "put", path: "/:id/integrations/meta", summary: "Verify and connect or replace credentials; queue initial import", body: z.object({ accountId: z.string().regex(/^(act_)?[0-9]{1,30}$/), token: z.string().min(1).max(8192).meta({ writeOnly: true }) }), success: { status: 200, description: "Saved connection; token is never returned", schema: metadata }, errors: [400, 401, 403, 404] },
    { method: "delete", path: "/:id/integrations/meta", summary: "Erase the connection and cancel work while preserving imported data", success: { status: 204, description: "Disconnected" }, errors: [401, 403, 404] },
    { method: "post", path: "/:id/integrations/meta/sync", summary: "Queue manual refresh, coalescing concurrent requests", success: { status: 202, description: "Current import status", schema: metadata }, errors: [401, 403, 404] },
  ],
};
