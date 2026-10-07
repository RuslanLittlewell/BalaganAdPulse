import type { RouteDoc } from "#shared/presentation/openapi.js";
import { z } from "zod";
import { editSchema, generateSchema, listQuerySchema, reportListSchema, reportSchema, reportSummarySchema } from "./report-schemas.js";

const report = { status: 200, description: "The report", schema: reportSchema } as const;

export const reportDoc: RouteDoc = {
  tag: "Reports",
  tagDescription: "A project's monthly advertising report: figures computed from the synced metrics when generated or refreshed, a hand-corrected lead count, messenger contacts, conclusions, a plan and the month's best ads. Drafts are seen by admins and managers alone. Money is a string with four decimals; changes are fractions.",
  operations: [
    { method: "get", path: "/", summary: "List the project's reports, newest month first, and the ended months staff may still generate", success: { status: 200, description: "The reports", schema: reportListSchema }, errors: [401, 404] },
    { method: "post", path: "/", summary: "Generate the report for a month that has ended", body: generateSchema, success: { status: 201, description: "The new draft", schema: reportSchema }, errors: [400, 401, 403, 404, 409] },
    { method: "get", path: "/:reportId", summary: "Read a report", success: report, errors: [401, 404] },
    { method: "patch", path: "/:reportId", summary: "Correct leads, set messenger contacts, conclusions, plan or the chosen ads", body: editSchema, success: report, errors: [400, 401, 403, 404] },
    { method: "delete", path: "/:reportId", summary: "Delete a report", success: { status: 204, description: "The report is gone" }, errors: [401, 403, 404] },
    { method: "put", path: "/:reportId/cover", summary: "Upload the report's cover picture: a JPEG, PNG or WebP image up to 10 MB", bodyType: "multipart/form-data", body: { type: "object", properties: { image: { type: "string", format: "binary" } }, required: ["image"] }, success: report, errors: [400, 401, 403, 404] },
    { method: "get", path: "/:reportId/cover", summary: "Read the report's cover picture", success: { status: 200, description: "The picture", contentType: "image/*", schema: { type: "string", format: "binary" } }, errors: [401, 404] },
    { method: "delete", path: "/:reportId/cover", summary: "Remove the report's cover picture", success: report, errors: [401, 403, 404] },
    { method: "post", path: "/:reportId/refresh", summary: "Recompute the figures from the current synced data", success: report, errors: [401, 403, 404] },
    { method: "post", path: "/:reportId/publish", summary: "Publish the report to everyone who reaches the project", success: report, errors: [401, 403, 404] },
    { method: "post", path: "/:reportId/unpublish", summary: "Return the report to draft", success: report, errors: [401, 403, 404] },
  ],
};

export const reportIndexDoc: RouteDoc = {
  tag: "Reports",
  operations: [
    { method: "get", path: "/", summary: "List the reports of every reachable project, newest month first", query: listQuerySchema, success: { status: 200, description: "The reports", schema: z.array(reportSummarySchema) }, errors: [400, 401] },
    { method: "get", path: "/:reportId", summary: "Read a report by its id", success: report, errors: [401, 404] },
  ],
};
