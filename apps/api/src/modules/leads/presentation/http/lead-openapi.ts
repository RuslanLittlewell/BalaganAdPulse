import { z } from 'zod';
import { arrayOf, ref, type ComponentDocs, type RouteDoc } from '#shared/presentation/openapi.js';
import { LEAD_ORIGINS, LEAD_STAGES } from '../../domain/lead.js';
import {createLeadSchema,updateLeadSchema,moveLeadSchema} from './lead-schemas.js';
const metaEntity=z.object({externalId:z.string(),name:z.string()});
const metaSource=z.object({accountId:z.string(),formId:z.string(),campaign:metaEntity,adSet:metaEntity,ad:metaEntity,submittedAt:z.iso.datetime(),answers:z.array(z.object({question:z.string(),values:z.array(z.string())})),answersOmitted:z.boolean()});
export const leadComponents:ComponentDocs={Lead:z.object({id:z.uuid(),orgId:z.uuid(),clientId:z.uuid().nullable(),name:z.string(),company:z.string().nullable(),phone:z.string().nullable(),email:z.string().nullable(),website:z.string().nullable(),source:z.string().nullable(),notes:z.string().nullable(),projectId:z.uuid().nullable(),campaignId:z.uuid().nullable(),adId:z.uuid().nullable(),origin:z.enum(LEAD_ORIGINS),ad:z.object({id:z.uuid(),name:z.string(),externalId:z.string().nullable()}).nullable(),metaSource:metaSource.nullable(),stage:z.enum(LEAD_STAGES),position:z.int(),createdAt:z.iso.datetime(),updatedAt:z.iso.datetime()}),LeadBoard:z.object({key:z.string(),label:z.string(),capabilities:z.object({create:z.boolean(),update:z.boolean(),delete:z.boolean()})})};
export const leadDoc:RouteDoc={tag:'CRM',tagDescription:'Separate agency and client sales funnels; winning changes status only',operations:[
  {method:'get',path:'/boards',summary:'List reachable boards',success:{status:200,description:'Authorized boards',schema:arrayOf(ref('LeadBoard'))},errors:[401,403]},
  {method:'get',path:'/boards/:boardKey/leads',summary:'List board leads',success:{status:200,description:'Ordered leads',schema:arrayOf(ref('Lead'))},errors:[401,403,404]},
  {method:'post',path:'/boards/:boardKey/leads',summary:'Create a lead',body:createLeadSchema,success:{status:201,description:'Created lead',schema:ref('Lead')},errors:[400,401,403,404]},
  {method:'get',path:'/boards/:boardKey/leads/:id',summary:'Read a lead',success:{status:200,description:'Lead',schema:ref('Lead')},errors:[401,403,404]},
  {method:'patch',path:'/boards/:boardKey/leads/:id',summary:'Edit lead contact details; an imported lead keeps its project and campaign',body:updateLeadSchema,success:{status:200,description:'Updated lead',schema:ref('Lead')},errors:[400,401,403,404]},
  {method:'delete',path:'/boards/:boardKey/leads/:id',summary:'Delete a lead',success:{status:204,description:'Lead deleted'},errors:[401,403,404]},
  {method:'patch',path:'/boards/:boardKey/leads/:id/move',summary:'Move and reorder a lead',body:moveLeadSchema,success:{status:200,description:'Authoritative board order',schema:arrayOf(ref('Lead'))},errors:[400,401,403,404]},
]};
