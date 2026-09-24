import { z } from 'zod';
import { COLUMN_NAME_LIMIT, LEAD_STAGES, TAG_LENGTH_LIMIT, TAG_LIMIT } from '../../domain/lead.js';
const optionalText=(limit:number)=>z.string().trim().max(limit).nullable().optional();
const fields=z.object({
  name:z.string().trim().min(1).max(200),company:optionalText(200),phone:optionalText(50),
  email:z.union([z.string().trim().max(254).email(),z.literal('')]).nullable().optional(),
  website:z.union([z.url({protocol:/^https?$/}).max(2048),z.literal('')]).nullable().optional(),
  source:optionalText(200),notes:optionalText(10000),
  service:optionalText(200),telegram:optionalText(100),messenger:optionalText(100),
  amount:z.string().trim().regex(/^\d{1,14}(\.\d{1,4})?$/,'Amount must be a nonnegative number with at most four decimals').nullable().optional(),
  tags:z.array(z.string().trim().min(1).max(TAG_LENGTH_LIMIT)).max(TAG_LIMIT)
    .refine(tags=>new Set(tags.map(tag=>tag.toLowerCase())).size===tags.length,{message:'Tags must differ from each other'}).optional(),
  campaignId:z.uuid().nullable().optional(),assigneeId:z.uuid().nullable().optional(),
}).strict();
export const leadContactSchemas={name:fields.shape.name,company:z.string().trim().max(200),phone:z.string().trim().max(50),email:z.string().trim().max(254).email()};
const stage=z.union([z.enum(LEAD_STAGES),z.uuid()]);
const position=z.number().int().min(0).max(2147483647);
const columnName=z.string().trim().min(1).max(COLUMN_NAME_LIMIT);
export const createLeadSchema=fields.extend({stage:stage.optional()});
export const updateLeadSchema=fields.partial();
export const moveLeadSchema=z.object({stage,position}).strict();
export const createColumnSchema=z.object({name:columnName}).strict();
export const updateColumnSchema=z.object({name:columnName.optional(),position:position.optional()}).strict().refine(input=>input.name!==undefined||input.position!==undefined,{message:'Provide a name or a position'});
const calendarDay=z.string().regex(/^\d{4}-\d{2}-\d{2}$/,'Expected a YYYY-MM-DD date').transform(value=>new Date(`${value}T00:00:00.000Z`)).refine(date=>!Number.isNaN(date.getTime()),'Expected a real calendar date');
export const stageCountsQuerySchema=z.object({from:calendarDay,to:calendarDay});
export function normalize<T extends Record<string,unknown>>(input:T):T { return Object.fromEntries(Object.entries(input).map(([key,value])=>[key,value===''?null:value])) as T; }
