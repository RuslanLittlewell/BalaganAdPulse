import { ref, type RouteDoc } from "#shared/presentation/openapi.js";
import { trialSignupSchema } from "./trial-signup-schemas.js";

export const trialSignupDoc: RouteDoc = {
  tag: "Trial signup",
  tagDescription: "Starting a trial organization without an invitation",
  operations: [
    {
      method: "post",
      path: "/",
      summary: "Ask for a trial organization",
      description: "Emails a confirmation link when no account uses the address. The answer is the same either way.",
      open: true,
      body: trialSignupSchema,
      success: { status: 202, description: "The request is taken; a link is sent if the email is free" },
      errors: [400, 429, 503],
    },
    {
      method: "get",
      path: "/:token",
      summary: "Check a confirmation link",
      open: true,
      success: { status: 204, description: "The link can still create an organization" },
      errors: [404, 429],
    },
    {
      method: "post",
      path: "/:token/confirm",
      summary: "Create the organization with a confirmation link",
      description: "Creates a trial organization and its first administrator, then signs in.",
      open: true,
      success: { status: 200, description: "The new session, also set as cookies", schema: ref("TokenPair") },
      errors: [404, 429],
    },
  ],
};
