import { z } from "zod";
import type { RouteDoc } from "#shared/presentation/openapi.js";
export const metadata = z.object({ id: z.uuid(), provider: z.enum(["META", "GOOGLE"]), accountId: z.string(), currency: z.string(), timezone: z.string(), status: z.enum(["QUEUED", "RUNNING", "SUCCESS", "ERROR", "AUTH_REQUIRED"]), lastSuccessAt: z.iso.datetime().nullable(), lastError: z.string().nullable(), nextDailyAt: z.iso.datetime(), leadsEnabled: z.boolean(), leads: z.object({ status: z.enum(["WAITING", "OK", "ACCESS_REQUIRED", "ERROR"]), lastSuccessAt: z.iso.datetime().nullable(), lastError: z.string().nullable() }) }).nullable();
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
          kind: z.enum(["IMAGE", "VIDEO", "TEXT"]),
          title: z.string().nullable(),
          body: z.string().nullable(),
          hasFile: z.boolean(),
          hasPoster: z.boolean(),
          sourceUrl: z.string().nullable(),
        })),
      },
      errors: [401, 404],
    },
    { method: "get", path: "/:id/preview", summary: "Read the provider's rendered preview of one ad", success: { status: 200, description: "A short-lived frame address rendering the ad", schema: z.object({ url: z.url() }) }, errors: [401, 404] },
  ],
};

const customerId = z.string().regex(/^\d{1,20}$/);
export const googleIntegrationDoc: RouteDoc = {
  tag: "Google Ads integration",
  tagDescription: "Project editors connect Google Ads accounts by signing in with Google on the project. Each connection keeps its own credential, which is write-only.",
  operations: [
    { method: "post", path: "/:id/integrations/google/authorize", summary: "Start Google sign-in for a new connection, or for renewing an existing one", body: z.object({ integrationId: z.uuid().optional() }), bodyRequired: false, success: { status: 200, description: "The Google consent address to send the member to", schema: z.object({ url: z.url() }) }, errors: [400, 401, 403, 404] },
    { method: "get", path: "/:id/integrations/google/accounts", summary: "List the Google Ads accounts a completed sign-in reaches and the project does not yet hold", query: z.object({ authorization: z.uuid() }), success: { status: 200, description: "Accounts to choose from; empty while renewing an existing connection", schema: z.object({ renewing: z.boolean(), accounts: z.array(z.object({ accountId: customerId, name: z.string(), currency: z.string(), timezone: z.string(), loginCustomerId: customerId.nullable() })) }) }, errors: [400, 401, 403, 404] },
    { method: "post", path: "/:id/integrations/google", summary: "Connect the chosen account, or renew the credential of the connection the sign-in was started for; queue an import", body: z.object({ authorization: z.uuid(), accountId: customerId.optional(), loginCustomerId: customerId.nullish() }), success: { status: 201, description: "Saved connection; no credential is returned. 200 when an existing connection was renewed", schema: metadata }, errors: [400, 401, 403, 404, 409] },
  ],
};
export const googleCallbackDoc: RouteDoc = {
  tag: "Google Ads integration",
  operations: [
    { method: "get", path: "/callback", summary: "Receive Google's answer to a sign-in and send the browser back to the project", open: true, query: z.object({ state: z.string().optional(), code: z.string().optional() }), success: { status: 302, description: "Redirect to the project with the finished sign-in in the query, or google=failed" } },
  ],
};
