import { z } from "zod";
import { avatarUploadBody } from "#shared/presentation/avatar.js";
import { arrayOf, ref, type ComponentDocs, type RouteDoc } from "#shared/presentation/openapi.js";
import { CURRENCIES, PROJECT_PRIORITIES } from "../../domain/project.js";
import { createProjectSchema, updateProjectSchema } from "./project-schemas.js";

const project = z.object({
  id: z.uuid(),
  clientId: z.uuid(),
  name: z.string(),
  niche: z.string().nullable(),
  monthlyBudget: z.string().nullable(),
  budgetCurrency: z.enum(CURRENCIES),
  priority: z.enum(PROJECT_PRIORITIES),
  image: z.string().nullable(),
  avatarPath: z.string().nullable(),
  position: z.int(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const projectComponents: ComponentDocs = { Project: project };

export const projectDoc: RouteDoc = {
  tag: "Projects",
  tagDescription: "A client's projects, their budget, their priority and their order on the board",
  operations: [
    {
      method: "post",
      path: "/",
      summary: "Add a project to a client",
      body: createProjectSchema,
      success: { status: 201, description: "The project", schema: ref("Project") },
      errors: [400, 401, 403, 404],
    },
    {
      method: "get",
      path: "/",
      summary: "List the projects this actor reaches",
      query: z.object({ clientId: z.uuid().optional() }),
      success: { status: 200, description: "The projects, in board order", schema: arrayOf(ref("Project")) },
      errors: [401, 403],
    },
    {
      method: "get",
      path: "/:id",
      summary: "Read a project",
      success: { status: 200, description: "The project, with its picture", schema: ref("Project") },
      errors: [401, 403, 404],
    },
    {
      method: "patch",
      path: "/:id",
      summary: "Change a project",
      body: updateProjectSchema,
      success: { status: 200, description: "The project as it now stands", schema: ref("Project") },
      errors: [400, 401, 403, 404],
    },
    {
      method: "delete",
      path: "/:id",
      summary: "Delete a project",
      success: { status: 204, description: "The project is gone" },
      errors: [401, 403, 404],
    },
    {
      method: "put",
      path: "/:id/avatar",
      summary: "Save a project's picture",
      bodyType: "multipart/form-data",
      body: avatarUploadBody,
      success: { status: 200, description: "The project, carrying the new picture", schema: ref("Project") },
      errors: [400, 401, 403, 404],
    },
  ],
};
