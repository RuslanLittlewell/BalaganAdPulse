import { z } from "zod";

const webhookUrl = z.string().trim().min(1, "webhookUrl is required").max(2048);
const applicationToken = z.string().trim().min(1, "applicationToken is required").max(200);

export const connectSchema = z.object({ webhookUrl, applicationToken }).strict();

export const changeConnectionSchema = z.object({
  webhookUrl: webhookUrl.optional(),
  applicationToken: applicationToken.optional(),
  enabled: z.boolean().optional(),
  inboundProjectId: z.string().uuid().nullable().optional(),
}).strict();

export const stageMappingSchema = z.object({
  links: z.array(z.object({ stageKey: z.string().min(1).max(64), statusId: z.string().min(1).max(64).nullable() }).strict()).max(500),
}).strict();

export const runSchema = z.object({ direction: z.enum(["UPLOAD", "DOWNLOAD"]) }).strict();

export const connectionViewSchema = z.object({
  portalHost: z.string(),
  status: z.enum(["ACTIVE", "AUTH_REQUIRED"]),
  enabled: z.boolean(),
  inboundProjectId: z.string().nullable(),
  connectedAt: z.string(),
  lastSyncAt: z.string().nullable(),
  lastError: z.string().nullable(),
  webhookUrl: z.string(),
});

export const statusSchema = z.object({ id: z.string(), name: z.string() });

export const stageSchema = z.object({
  key: z.string(),
  name: z.string(),
  projectId: z.string().nullable(),
  projectName: z.string().nullable(),
  statusId: z.string().nullable(),
});

export const problemSchema = z.object({
  kind: z.string(),
  key: z.string(),
  reason: z.string(),
  label: z.string().nullable(),
  createdAt: z.string(),
});

export const runViewSchema = z.object({
  id: z.string(),
  direction: z.enum(["UPLOAD", "DOWNLOAD"]),
  state: z.enum(["RUNNING", "DONE", "FAILED"]),
  created: z.number().int(),
  failed: z.number().int(),
  startedAt: z.string(),
  finishedAt: z.string().nullable(),
});
