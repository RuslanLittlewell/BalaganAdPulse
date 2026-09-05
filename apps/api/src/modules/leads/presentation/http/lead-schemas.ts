import { z } from 'zod';
import { LEAD_STAGES } from '../../domain/lead.js';
const optionalText=(limit:number)=>z.string().trim().max(limit).nullable().optional();
const fields=z.object({
  name:z.string().trim().min(1).max(200),company:optionalText(200),phone:optionalText(50),
  email:z.union([z.string().trim().max(254).email(),z.literal('')]).nullable().optional(),
  website:z.union([z.url({protocol:/^https?$/}).max(2048),z.literal('')]).nullable().optional(),
  source:optionalText(200),notes:optionalText(10000),
  projectId:z.uuid().nullable().optional(),campaignId:z.uuid().nullable().optional(),
}).strict();
export const createLeadSchema=fields.extend({stage:z.enum(LEAD_STAGES).optional()});
export const updateLeadSchema=fields.partial();
export const moveLeadSchema=z.object({stage:z.enum(LEAD_STAGES),position:z.number().int().min(0).max(2147483647)}).strict();
export function normalize<T extends Record<string,unknown>>(input:T):T { return Object.fromEntries(Object.entries(input).map(([key,value])=>[key,value===''?null:value])) as T; }
