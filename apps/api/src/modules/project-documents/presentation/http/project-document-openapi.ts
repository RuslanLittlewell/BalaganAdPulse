import { z } from "zod";
import { arrayOf, ref, type ComponentDocs, type RouteDoc } from "#shared/presentation/openapi.js";
import { createDocumentSchema, updateDocumentSchema } from "./project-document-schemas.js";

const author = z.object({ id: z.uuid(), name: z.string() }).nullable();

const summary = z.object({
  id: z.uuid(),
  projectId: z.uuid(),
  title: z.string(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  updatedBy: author,
});

const document = summary.extend({
  content: z.record(z.string(), z.unknown()).nullable(),
  createdBy: author,
});

export const projectDocumentComponents: ComponentDocs = {
  ProjectDocumentSummary: summary,
  ProjectDocument: document,
};

export const projectDocumentDoc: RouteDoc = {
  tag: "Project documents",
  tagDescription:
    "A project's internal notebook: rich-text documents read by the agency's admins, managers and guests who reach the project and written by its admins and managers. Each save replaces the document; the last one wins.",
  operations: [
    {
      method: "get",
      path: "/",
      summary: "List the project's documents in the order they were created",
      success: { status: 200, description: "The documents, without their text", schema: arrayOf(ref("ProjectDocumentSummary")) },
      errors: [401, 403, 404],
    },
    {
      method: "post",
      path: "/",
      summary: "Create an empty document",
      body: createDocumentSchema,
      success: { status: 201, description: "The document", schema: ref("ProjectDocument") },
      errors: [400, 401, 403, 404],
    },
    {
      method: "get",
      path: "/:id",
      summary: "Read a document with its text",
      success: { status: 200, description: "The document", schema: ref("ProjectDocument") },
      errors: [401, 403, 404],
    },
    {
      method: "patch",
      path: "/:id",
      summary: "Replace a document's title, text or both",
      body: updateDocumentSchema,
      success: { status: 200, description: "The document as it now stands", schema: ref("ProjectDocument") },
      errors: [400, 401, 403, 404],
    },
    {
      method: "delete",
      path: "/:id",
      summary: "Delete a document for good",
      success: { status: 204, description: "The document is gone" },
      errors: [401, 403, 404],
    },
  ],
};
