import { z } from "zod";
import { ref, type RouteDoc } from "#shared/presentation/openapi.js";
import {
  addressSchema,
  backupCodesSchema,
  challengeSchema,
  codeSchema,
  organizationSchema,
  platformResetSchema,
  requirementSchema,
  setupSchema,
  statusSchema,
} from "./two-factor-schemas.js";

export const twoFactorDoc: RouteDoc = {
  tag: "Two-factor sign-in",
  tagDescription: "The signed-in account's second factor: an authenticator app, backup codes and the addresses it trusts.",
  operations: [
    { method: "get", path: "/", summary: "Read the account's two-factor state", success: { status: 200, description: "The state", schema: statusSchema }, errors: [401] },
    { method: "post", path: "/setup", summary: "Start setting up an authenticator app", description: "Creates a new unconfirmed secret and returns it as a key, an otpauth URI and a QR code.", success: { status: 200, description: "The secret to scan", schema: setupSchema }, errors: [401, 409, 503] },
    { method: "post", path: "/confirm", summary: "Turn two-factor sign-in on with a code", body: codeSchema, success: { status: 200, description: "Ten backup codes, shown once", schema: backupCodesSchema }, errors: [400, 401, 409, 429] },
    { method: "post", path: "/disable", summary: "Turn two-factor sign-in off", body: codeSchema, success: { status: 204, description: "Turned off" }, errors: [400, 401, 403, 404, 429] },
    { method: "post", path: "/backup-codes", summary: "Replace the backup codes", body: codeSchema, success: { status: 200, description: "New backup codes, shown once", schema: backupCodesSchema }, errors: [400, 401, 404, 429] },
    { method: "get", path: "/addresses", summary: "List trusted addresses", success: { status: 200, description: "The addresses", schema: z.array(addressSchema) }, errors: [401] },
    { method: "delete", path: "/addresses", summary: "Forget every trusted address", success: { status: 204, description: "Forgotten" }, errors: [401] },
    { method: "delete", path: "/addresses/:id", summary: "Forget one trusted address", success: { status: 204, description: "Forgotten" }, errors: [401, 404] },
  ],
};

export const twoFactorSignInDoc: RouteDoc = {
  tag: "Two-factor sign-in",
  operations: [
    { method: "post", path: "/", summary: "Finish signing in with a code", description: "Takes the challenge a sign-in or a password reset returned and a code from the app or a backup code.", open: true, body: challengeSchema, success: { status: 200, description: "The session, also set as cookies", schema: ref("TokenPair") }, errors: [400, 401, 403, 429] },
  ],
};

export const organizationTwoFactorDoc: RouteDoc = {
  tag: "Two-factor sign-in",
  operations: [
    { method: "get", path: "/", summary: "Read the organization's requirement", success: { status: 200, description: "The requirement and who is enrolled", schema: organizationSchema }, errors: [401, 403] },
    { method: "put", path: "/", summary: "Require two-factor sign-in for employees or stop requiring it", body: requirementSchema, success: { status: 200, description: "The requirement", schema: requirementSchema }, errors: [400, 401, 403] },
    { method: "post", path: "/members/:membershipId/reset", summary: "Reset a member's second factor", success: { status: 204, description: "Reset" }, errors: [401, 403, 404] },
  ],
};

export const platformTwoFactorDoc: RouteDoc = {
  tag: "Two-factor sign-in",
  operations: [
    { method: "post", path: "/reset", summary: "Reset any account's second factor by email", body: platformResetSchema, success: { status: 204, description: "Reset" }, errors: [400, 401, 403, 404] },
  ],
};
