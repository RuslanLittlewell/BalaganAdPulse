import { z } from "zod";

export const issueShareLinkSchema = z.object({
  renew: z.boolean().default(false),
}).strict();

export const shareLinkSchema = z.object({
  token: z.string().describe("The secret part of the address /share/{token}"),
  createdAt: z.iso.datetime(),
});
