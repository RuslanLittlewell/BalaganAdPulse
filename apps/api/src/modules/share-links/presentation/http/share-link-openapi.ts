import type { RouteDoc } from "#shared/presentation/openapi.js";
import { issueShareLinkSchema, shareLinkSchema } from "./share-link-schemas.js";

export const shareLinkDoc: RouteDoc = {
  tag: "Share links",
  tagDescription:
    "The one address per project that opens its metrics to anyone, read only and without a session. Only admins see, issue, replace and remove it; replacing gives it a new token and stops the old address at once.",
  operations: [
    {
      method: "get",
      path: "/:id/share-link",
      summary: "Read a project's share link",
      success: { status: 200, description: "The link, or null when the project has none", schema: shareLinkSchema.nullable() },
      errors: [401, 403, 404],
    },
    {
      method: "put",
      path: "/:id/share-link",
      summary: "Create a project's share link, or replace its token when renew is true",
      description: "Without renew, an existing link is returned unchanged.",
      body: issueShareLinkSchema,
      bodyRequired: false,
      success: { status: 200, description: "The existing or replaced link; 201 when it was created", schema: shareLinkSchema },
      errors: [400, 401, 403, 404],
    },
    {
      method: "delete",
      path: "/:id/share-link",
      summary: "Switch a project's share link off",
      success: { status: 204, description: "The address no longer opens the project" },
      errors: [401, 403, 404],
    },
  ],
};
