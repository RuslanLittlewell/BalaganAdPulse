import { z } from "zod";
import { ref, type ComponentDocs, type RouteDoc } from "#shared/presentation/openapi.js";

const credentials = z.object({
  login: z.string(),
  password: z.string().nullable(),
  createdAt: z.iso.datetime(),
});

export const clientAccountComponents: ComponentDocs = { ClientCredentials: credentials };

export const clientAccountDoc: RouteDoc = {
  tag: "Client cabinet access",
  tagDescription:
    "A login and password the agency issues for a client's cabinet. The account is the client's principal. Admins only.",
  operations: [
    {
      method: "get",
      path: "/",
      summary: "Read a client's cabinet credentials",
      description:
        "Answers null when the client has no access. The password is null once the client has set one of their own.",
      success: { status: 200, description: "The credentials, or null", schema: credentials.nullable() },
      errors: [401, 403, 404, 503],
    },
    {
      method: "post",
      path: "/",
      summary: "Create a client's cabinet access",
      description: "Generates a login from the client's name, ending with @balagan.pro, and a password, and enrols the account as the client's principal. The account has no email.",
      success: { status: 201, description: "The new credentials", schema: ref("ClientCredentials") },
      errors: [401, 403, 404, 409, 503],
    },
    {
      method: "post",
      path: "/password",
      summary: "Issue a new cabinet password",
      description: "Replaces the password and ends the account's sessions. The login stays.",
      success: { status: 200, description: "The credentials with the new password", schema: ref("ClientCredentials") },
      errors: [401, 403, 404, 503],
    },
  ],
};
