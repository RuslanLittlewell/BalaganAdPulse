import { z } from 'zod';
import { MAX_LEAD_NOTE_LENGTH } from '#modules/leads/domain/lead-note.js';
import { COLUMN_NAME_LIMIT, CUSTOM_COLUMN_LIMIT, LEAD_STAGES, TAG_LENGTH_LIMIT, TAG_LIMIT } from '#modules/leads/domain/lead.js';
import { CONVERSION_EVENT_NAME_LIMIT } from '#modules/leads/domain/conversion-event.js';
import { FIELD_NAME_LIMIT, LEAD_FIELD_TYPES, OPTION_COLORS, OPTION_LIMIT, OPTION_NAME_LIMIT } from '#modules/leads/domain/lead-field.js';
const optionalText=(limit:number)=>z.string().trim().max(limit).nullable().optional();
const email=z.union([z.string().trim().max(254).email(),z.literal('')]).nullable().optional();
const website=z.union([z.url({protocol:/^https?$/}).max(2048),z.literal('')]).nullable().optional();
const fields=z.object({
  name:z.string().trim().min(1).max(200),
  personId:z.uuid().nullable().optional(),companyId:z.uuid().nullable().optional(),
  contact:z.object({phone:optionalText(50),email,telegram:optionalText(100),messenger:optionalText(100)}).strict().optional(),
  organization:z.object({website}).strict().optional(),
  source:optionalText(200),notes:optionalText(10000),
  service:optionalText(200),
  amount:z.string().trim().regex(/^\d{1,14}(\.\d{1,4})?$/,'Amount must be a nonnegative number with at most four decimals').nullable().optional(),
  tags:z.array(z.string().trim().min(1).max(TAG_LENGTH_LIMIT)).max(TAG_LIMIT)
    .refine(tags=>new Set(tags.map(tag=>tag.toLowerCase())).size===tags.length,{message:'Tags must differ from each other'}).optional(),
  campaignId:z.uuid().nullable().optional(),assigneeId:z.uuid().nullable().optional(),
  customValues:z.record(z.string(),z.unknown()).optional(),
}).strict();
export const leadContactSchemas={name:fields.shape.name,company:z.string().trim().max(200),phone:z.string().trim().max(50),email:z.string().trim().max(254).email()};
const recordName=z.string().trim().min(1).max(200);
export const createCompanySchema=z.object({name:recordName,website,phone:optionalText(50),notes:optionalText(10000)}).strict();
export const updateCompanySchema=createCompanySchema.partial().strict();
export const createPersonSchema=z.object({
  name:recordName,phone:optionalText(50),email,telegram:optionalText(100),messenger:optionalText(100),
  companyId:z.uuid().nullable().optional(),notes:optionalText(10000),
}).strict();
export const updatePersonSchema=createPersonSchema.partial().strict();
const stage=z.union([z.enum(LEAD_STAGES),z.uuid()]);
const position=z.number().int().min(0).max(2147483647);
const columnName=z.string().trim().min(1).max(COLUMN_NAME_LIMIT);
export const createLeadSchema=fields.extend({stage:stage.optional()});
export const updateLeadSchema=fields.partial();
export const moveLeadSchema=z.object({stage,position}).strict();
export const createColumnSchema=z.object({name:columnName,color:z.enum(OPTION_COLORS).optional()}).strict();
export const updateColumnSchema=z.object({name:columnName.optional(),position:position.optional(),color:z.enum(OPTION_COLORS).optional()}).strict().refine(input=>input.name!==undefined||input.position!==undefined||input.color!==undefined,{message:'Provide a name, a position or a color'});
const fieldName=z.string().trim().min(1).max(FIELD_NAME_LIMIT);
const fieldOptions=z.array(z.object({id:z.string().min(1).max(100).optional(),name:z.string().trim().min(1).max(OPTION_NAME_LIMIT),color:z.enum(OPTION_COLORS)}).strict()).max(OPTION_LIMIT);
export const createFieldSchema=z.object({name:fieldName,type:z.enum(LEAD_FIELD_TYPES),options:fieldOptions.optional()}).strict();
export const updateFieldSchema=z.object({name:fieldName.optional(),options:fieldOptions.optional(),position:position.optional()}).strict().refine(input=>input.name!==undefined||input.options!==undefined||input.position!==undefined,{message:'Provide a name, options or a position'});
const calendarDay=z.string().regex(/^\d{4}-\d{2}-\d{2}$/,'Expected a YYYY-MM-DD date').transform(value=>new Date(`${value}T00:00:00.000Z`)).refine(date=>!Number.isNaN(date.getTime()),'Expected a real calendar date');
export const stageCountsQuerySchema=z.object({from:calendarDay,to:calendarDay});
export function normalize<T extends Record<string,unknown>>(input:T):T { return Object.fromEntries(Object.entries(input).map(([key,value])=>[key,value===''?null:value])) as T; }

export const leadNoteSchema=z.object({body:z.string().trim().min(1,'A note needs text').max(MAX_LEAD_NOTE_LENGTH,'The note is too long')}).strict();
const eventName=z.string().trim().min(1).max(CONVERSION_EVENT_NAME_LIMIT);
const eventStages=z.array(stage).max(LEAD_STAGES.length+CUSTOM_COLUMN_LIMIT);
export const createConversionEventSchema=z.object({name:eventName,stages:eventStages,carriesAmount:z.boolean().default(false)}).strict();
export const updateConversionEventSchema=z.object({name:eventName.optional(),stages:eventStages.optional(),carriesAmount:z.boolean().optional()}).strict().refine(input=>input.name!==undefined||input.stages!==undefined||input.carriesAmount!==undefined,{message:'Provide a name, stages or the amount option'});
