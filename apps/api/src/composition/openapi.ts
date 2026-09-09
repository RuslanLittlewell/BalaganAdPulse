import { adPreviewDoc, integrationDoc } from "../modules/integrations/presentation/http/integration-openapi.js";
import { createRequire } from "node:module";
import path from "node:path";
import express, { Router } from "express";
import {
  buildOpenApiDocument,
  mergeComponents,
  type OpenApiDocument,
  type RouteDoc,
} from "#shared/presentation/openapi.js";
import { authDoc, identityComponents, userDoc } from "../modules/identity/presentation/http/identity-openapi.js";
import { memberComponents, memberDoc, sessionDoc } from "../modules/members/presentation/http/member-openapi.js";
import { inviteComponents, inviteDoc, registrationResolverDoc } from "../modules/invites/presentation/http/invite-openapi.js";
import { auditComponents, auditDoc } from "../modules/audit/presentation/http/audit-openapi.js";
import { clientComponents, clientDoc } from "../modules/clients/presentation/http/client-openapi.js";
import { projectComponents, projectDoc } from "../modules/projects/presentation/http/project-openapi.js";
import { projectGroupDoc, projectLayoutDoc } from "../modules/project-layout/presentation/http/layout-openapi.js";
import {
  adCreativeDoc,
  adSetDoc,
  campaignComponents,
  campaignDoc,
  projectMetricDoc,
  summaryDoc,
} from "../modules/campaigns/presentation/http/campaign-openapi.js";
import { taskComponents, taskDoc, taskImageDoc } from "../modules/tasks/presentation/http/task-openapi.js";
import { mountPath } from "./create-routes.js";
import { leadDoc, leadComponents } from '../modules/leads/presentation/http/lead-openapi.js';

const require = createRequire(import.meta.url);

const { version } = require("../../package.json") as { version: string };

const DOCS_PATH = "/docs";
const DOCUMENT_PATH = "/openapi.json";

const documentationDoc: RouteDoc = {
  tag: "Documentation",
  tagDescription: "This description of the API, and the page that renders it",
  operations: [
    {
      method: "get",
      path: DOCUMENT_PATH,
      summary: "Read this document",
      open: true,
      success: { status: 200, description: "The OpenAPI description of this API", schema: { type: "object" } },
    },
    {
      method: "get",
      path: DOCS_PATH,
      summary: "Browse this document",
      open: true,
      success: {
        status: 200,
        description: "A page rendering the description",
        contentType: "text/html",
        schema: { type: "string" },
      },
    },
  ],
};

export function apiDocument(): OpenApiDocument {
  return buildOpenApiDocument({
    info: {
      title: "AdPulse API",
      version,
      description: [
        "The media buyer's dashboard behind adpulse.",
        "",
        "Every endpoint but registering, logging in, refreshing, logging out and resolving a",
        "registration code needs a session: either the `adpulse_access` cookie the login",
        "endpoints set, or the same token as a bearer header.",
        "",
        "A record the actor may not reach answers 404 rather than 403, so a response never",
        "confirms that it exists.",
      ].join("\n"),
    },
    groups: [
      { mount: mountPath("docs"), ...documentationDoc },
      { mount: mountPath("open-auth"), ...authDoc },
      { mount: mountPath("registration-resolver"), ...registrationResolverDoc },
      { mount: mountPath("session"), ...sessionDoc },
      { mount: mountPath("user"), ...userDoc },
      { mount: mountPath("invites"), ...inviteDoc },
      { mount: mountPath("members"), ...memberDoc },
      { mount: mountPath("audit"), ...auditDoc },
      { mount: mountPath("project-metrics"), ...projectMetricDoc },
      { mount: mountPath("integrations"), ...integrationDoc },
      { mount: mountPath("ad-previews"), ...adPreviewDoc },
      { mount: mountPath("projects"), ...projectDoc },
      { mount: mountPath("project-layout"), ...projectLayoutDoc },
      { mount: mountPath("project-groups"), ...projectGroupDoc },
      { mount: mountPath("clients"), ...clientDoc },
      { mount: mountPath("campaigns"), ...campaignDoc },
      { mount: mountPath("ad-sets"), ...adSetDoc },
      { mount: mountPath("ad-creatives"), ...adCreativeDoc },
      { mount: mountPath("summary"), ...summaryDoc },
      { mount: mountPath("tasks"), ...taskDoc },
      { mount: mountPath("leads"), ...leadDoc },
      { mount: mountPath("task-images"), ...taskImageDoc },
    ],
    components: mergeComponents(
      identityComponents,
      leadComponents,
      memberComponents,
      inviteComponents,
      auditComponents,
      clientComponents,
      projectComponents,
      campaignComponents,
      taskComponents,
    ),
  });
}

const swaggerUiAssets = () =>
  path.dirname(require.resolve("swagger-ui-dist/package.json"));

const page = (title: string) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <link rel="stylesheet" href="/api${DOCS_PATH}/swagger-ui.css" />
    <link rel="icon" href="/api${DOCS_PATH}/favicon-32x32.png" sizes="32x32" />
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="/api${DOCS_PATH}/swagger-ui-bundle.js"></script>
    <script>
      window.ui = SwaggerUIBundle({
        url: "/api${DOCUMENT_PATH}",
        dom_id: "#swagger-ui",
        withCredentials: true,
        persistAuthorization: true,
        docExpansion: "list",
        defaultModelsExpandDepth: 0,
      });
    </script>
  </body>
</html>
`;

export function createDocumentationRouter(document: OpenApiDocument): Router {
  const router = Router();
  const html = page(document.info.title);
  router.get(DOCUMENT_PATH, (_request, response) => {
    response.json(document);
  });
  router.get(DOCS_PATH, (_request, response) => {
    response.type("html").send(html);
  });
  router.use(DOCS_PATH, express.static(swaggerUiAssets(), { index: false }));
  return router;
}
