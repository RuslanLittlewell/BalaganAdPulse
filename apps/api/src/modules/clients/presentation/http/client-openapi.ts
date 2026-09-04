import { z } from "zod";
import { avatarUploadBody } from "#shared/presentation/avatar.js";
import { arrayOf, ref, type ComponentDocs, type RouteDoc } from "#shared/presentation/openapi.js";
import { createClientSchema, updateClientSchema } from "./client-schemas.js";

const client = z.object({
  id: z.uuid(),
  orgId: z.uuid(),
  name: z.string(),
  fullName: z.string().nullable(),
  organization: z.string().nullable(),
  unp: z.string().nullable(),
  phone: z.string().nullable(),
  telegram: z.string().nullable(),
  email: z.string().nullable(),
  website: z.string().nullable(),
  image: z.string().nullable(),
  avatarPath: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const clientComponents: ComponentDocs = { Client: client };

export const clientDoc: RouteDoc = {
  tag: "Clients",
  tagDescription: "The agency's clients and their contact details",
  operations: [
    {
      method: "post",
      path: "/",
      summary: "Add a client",
      body: createClientSchema,
      success: { status: 201, description: "The client", schema: ref("Client") },
      errors: [400, 401, 403],
    },
    {
      method: "get",
      path: "/",
      summary: "List the clients this actor reaches",
      success: { status: 200, description: "The clients", schema: arrayOf(ref("Client")) },
      errors: [401, 403],
    },
    {
      method: "get",
      path: "/:id",
      summary: "Read a client",
      success: { status: 200, description: "The client, with its picture", schema: ref("Client") },
      errors: [401, 403, 404],
    },
    {
      method: "patch",
      path: "/:id",
      summary: "Change a client's contact details",
      body: updateClientSchema,
      success: { status: 200, description: "The client as it now stands", schema: ref("Client") },
      errors: [400, 401, 403, 404],
    },
    {
      method: "delete",
      path: "/:id",
      summary: "Delete a client",
      success: { status: 204, description: "The client and its projects are gone" },
      errors: [401, 403, 404],
    },
    {
      method: "put",
      path: "/:id/avatar",
      summary: "Save a client's picture",
      bodyType: "multipart/form-data",
      body: avatarUploadBody,
      success: { status: 200, description: "The client, carrying the new picture", schema: ref("Client") },
      errors: [400, 401, 403, 404],
    },
  ],
};
