import { can } from '@adpulse/access-policy';
import { AppError } from '#shared/domain/index.js';
import type { ActorContext, IdGenerator, UnitOfWork, TransactionContext } from '#shared/application/index.js';
import type { AuditWriter } from '#modules/audit/index.js';
import { arrivalWindow, boardColumns, customColumnOf, CUSTOM_COLUMN_LIMIT, DEFAULT_COLUMN_COLOR, isLeadStage, LEAD_STAGE_NAMES, LEAD_STAGES, type BoardColumn, type LeadColumnRecord, type LeadFields, type LeadRecord, type LeadStage } from '../domain/lead.js';
import { buildActivity, campaignIdsIn } from '../domain/lead-activity.js';
import { applyCustomValues, type OptionColor } from '../domain/lead-field.js';
import type { CrmRecordRepository, LeadFieldRepository, LeadFileStorage, LeadRepository, LeadEvent } from './ports.js';
import { hasValues, type ContactPatch, type OrganizationPatch } from '../domain/crm-record.js';
export type LeadRecordLinks = Pick<CrmRecordRepository,'personInClient'|'companyInClient'|'createPerson'|'updatePerson'|'createCompany'|'updateCompany'|'person'|'company'|'projectsOf'>;
import { createBoardMutation } from './board-mutation.js';

export type LeadInput = Omit<LeadFields,'customValues'> & {customValues?: Readonly<Record<string, unknown>>; contact?: ContactPatch; organization?: OrganizationPatch};
export function createLeadUseCases(d: {leads:LeadRepository; fields:Pick<LeadFieldRepository,'list'>; records:LeadRecordLinks; storage:Pick<LeadFileStorage,'remove'>; audit:AuditWriter; ids:IdGenerator; unitOfWork:UnitOfWork; publish:(event:LeadEvent)=>void}) {
  const {authorize,mutation}=createBoardMutation(d);
  async function recordAudit(context:TransactionContext,actor:ActorContext,kind:'crm-person'|'crm-company',record:{id:string;clientId:string},action:'CREATE'|'UPDATE',changes:unknown) {
    await d.audit.append(context,{action,entityType:kind,entityId:record.id,clientId:record.clientId,projectId:null,summary:`${action} ${kind==='crm-person'?'person':'company'}`,changes:JSON.parse(JSON.stringify(changes))},actor);
  }
  async function linked(context:TransactionContext,actor:ActorContext,clientId:string,lead:{name:string;personId:string|null;companyId:string|null},input:Partial<LeadInput>) {
    let {personId,companyId}=lead;
    if (input.personId!==undefined) {
      if (input.personId&&!await d.records.personInClient(actor.orgId,clientId,input.personId,context)) throw new AppError('validation','That contact belongs to another client');
      personId=input.personId;
    }
    if (input.companyId!==undefined) {
      if (input.companyId&&!await d.records.companyInClient(actor.orgId,clientId,input.companyId,context)) throw new AppError('validation','That organization belongs to another client');
      companyId=input.companyId;
    }
    let touched=false;
    if (hasValues(input.organization)) {
      touched=true;
      if (companyId) {
        const before=await d.records.company(actor,clientId,companyId,context);
        const after=await d.records.updateCompany(context,actor,companyId,input.organization!);
        await recordAudit(context,actor,'crm-company',after,'UPDATE',{before,after});
      } else {
        const created=await d.records.createCompany(context,actor,{...input.organization,name:lead.name,id:d.ids.generate(),orgId:actor.orgId,clientId});
        await recordAudit(context,actor,'crm-company',created,'CREATE',{after:created});
        companyId=created.id;
      }
    }
    if (hasValues(input.contact)) {
      touched=true;
      if (personId) {
        const before=await d.records.person(actor,clientId,personId,context);
        const after=await d.records.updatePerson(context,actor,personId,input.contact!);
        await recordAudit(context,actor,'crm-person',after,'UPDATE',{before,after});
      } else {
        const created=await d.records.createPerson(context,actor,{...input.contact,name:lead.name,companyId,id:d.ids.generate(),orgId:actor.orgId,clientId});
        await recordAudit(context,actor,'crm-person',created,'CREATE',{after:created});
        personId=created.id;
      }
    }
    return {personId,companyId,touched};
  }
  async function announce(actor:ActorContext,clientId:string,board:string) {
    for (const other of await d.records.projectsOf(clientId)) if (other!==board) d.publish({kind:'crm.changed',orgId:actor.orgId,board:other});
  }
  async function attribution(board:string, before:Pick<LeadRecord,'campaignId'|'origin'>, input:Pick<LeadFields,'campaignId'>) {
    if (before.origin==='META') {
      if (input.campaignId!==undefined&&input.campaignId!==before.campaignId) throw new AppError('validation','An imported lead keeps the campaign it came from');
      return {campaignId:before.campaignId};
    }
    const campaignId = input.campaignId === undefined ? before.campaignId : input.campaignId;
    if (campaignId && !await d.leads.campaignInProject(campaignId,board)) {
      throw new AppError('validation','That campaign belongs to another project');
    }
    return {campaignId};
  }
  async function assignment(actor:ActorContext,board:string,before:Pick<LeadRecord,'assigneeId'>,input:Pick<LeadFields,'assigneeId'>) {
    const assigneeId=input.assigneeId===undefined?before.assigneeId:input.assigneeId;
    if (assigneeId&&!await d.leads.assigneeReachesBoard(actor.orgId,assigneeId,board)) {
      throw new AppError('validation','The assignee is not an active member of this project');
    }
    return {assigneeId};
  }
  function find(rows:LeadRecord[],id:string) {
    const row=rows.find(l=>l.id===id); if (!row) throw new AppError('not-found','Lead not found'); return row;
  }
  async function ordered(context:TransactionContext, rows:LeadRecord[]) {
    for (const [position,row] of rows.entries()) if(row.position!==position) await d.leads.update(context,row.id,{position});
  }
  async function placement(context:TransactionContext, actor:ActorContext, board:string, stage:string) {
    if (isLeadStage(stage)) return;
    if (!(await d.leads.columns(actor,board,context)).some(column=>column.id===stage)) throw new AppError('validation','That stage is not a column of this board');
  }
  function customColumn(columns:LeadColumnRecord[], id:string) {
    if (isLeadStage(id)) throw new AppError('validation','Fixed stages cannot be changed');
    const column=columns.find(candidate=>candidate.id===id); if (!column) throw new AppError('not-found','Column not found'); return column;
  }
  function assertNameFree(columns:LeadColumnRecord[], name:string, except?:string) {
    const taken=[...Object.values(LEAD_STAGE_NAMES),...columns.filter(column=>column.id!==except).map(column=>column.name)];
    if (taken.some(existing=>existing.toLowerCase()===name.toLowerCase())) throw new AppError('validation','A column with that name already exists on this board');
  }
  async function orderedColumns(context:TransactionContext, columns:LeadColumnRecord[]) {
    for (const [position,column] of columns.entries()) if(column.position!==position) await d.leads.updateColumn(context,column.id,{position});
  }
  async function repositionColumns(context:TransactionContext, existing:LeadColumnRecord[], target:BoardColumn[]) {
    const byId=new Map(existing.map(column=>[column.id,column]));
    let afterStage:LeadStage|null=null, position=0;
    for (const entry of target) {
      if (entry.kind==='FIXED') { afterStage=entry.id; position=0; continue; }
      const before=byId.get(entry.id);
      if (!before||before.afterStage!==afterStage||before.position!==position) await d.leads.updateColumn(context,entry.id,{afterStage,position});
      position++;
    }
  }
  async function audit(context:TransactionContext,actor:ActorContext,row:LeadRecord,action:'CREATE'|'UPDATE'|'DELETE',changes:unknown) {
    const withoutSource=(value:unknown)=>value&&typeof value==='object'&&'metaSource' in value?{...value,metaSource:undefined,ad:undefined}:value;
    const trimmed=Object.fromEntries(Object.entries(changes as Record<string,unknown>).map(([key,value])=>[key,withoutSource(value)]));
    await d.audit.append(context,{action,entityType:'lead',entityId:row.id,clientId:row.project.clientId,projectId:row.projectId,summary:`${action} lead`,changes:JSON.parse(JSON.stringify(trimmed))},actor);
  }
  async function auditColumn(context:TransactionContext,actor:ActorContext,column:LeadColumnRecord,action:'CREATE'|'UPDATE'|'DELETE',changes:unknown) {
    await d.audit.append(context,{action,entityType:'lead-column',entityId:column.id,clientId:column.clientId,projectId:column.projectId,summary:`${action} lead column`,changes:JSON.parse(JSON.stringify(changes))},actor);
  }
  return {
    async boards(actor:ActorContext) { return (await d.leads.boards(actor)).map(b=>({...b,capabilities:{create:can(actor,'create','lead'),update:can(actor,'update','lead'),delete:can(actor,'delete','lead')}})); },
    async list(actor:ActorContext,board:string) { await authorize(actor,board,'read'); return d.leads.list(actor,board); },
    async activity(actor:ActorContext,board:string,id:string) {
      await authorize(actor,board,'read');
      if (!await d.leads.leadOnBoard(actor.orgId,board,id)) throw new AppError('not-found','Lead not found');
      const {events,importedAt}=await d.leads.history(actor.orgId,id);
      const [columns,campaigns,fields]=await Promise.all([d.leads.columns(actor,board),d.leads.campaignNames(campaignIdsIn(events)),d.fields.list(actor.orgId,board)]);
      return buildActivity(id,events,{columns:new Map(columns.map(column=>[column.id,column.name])),campaigns,fields},importedAt);
    },
    async read(actor:ActorContext,board:string,id:string) { await authorize(actor,board,'read'); return find(await d.leads.list(actor,board),id); },
    async create(actor:ActorContext,board:string,input:LeadInput & {stage?:string}) {
      let touched=false;
      let clientId='';
      const created=await mutation(actor,board,'create',async (context,rows)=> {
        clientId=await d.leads.clientOf(board);
        const stage=input.stage ?? 'NEW';
        await placement(context,actor,board,stage);
        const named=await attribution(board,{campaignId:null,origin:'MANUAL'},input);
        const assigned=await assignment(actor,board,{assigneeId:null},input);
        const customValues=applyCustomValues(await d.fields.list(actor.orgId,board,context),{},input.customValues);
        const links=await linked(context,actor,clientId,{name:input.name,personId:null,companyId:null},input);
        touched=links.touched;
        const {contact:_contact,organization:_organization,...fields}=input;
        const row=await d.leads.create(context,{...fields,...named,...assigned,customValues,personId:links.personId,companyId:links.companyId,id:d.ids.generate(),orgId:actor.orgId,projectId:board,stage,position:0});
        await ordered(context,[{...row,position:-1},...rows.filter(l=>l.stage===stage)]);
        await audit(context,actor,row,'CREATE',{after:row}); return row;
      });
      if (touched) await announce(actor,clientId,board);
      return created;
    },
    async update(actor:ActorContext,board:string,id:string,input:Partial<LeadInput>) {
      let touched=false;
      let clientId='';
      const updated=await mutation(actor,board,'update',async(context,rows)=>{
        clientId=await d.leads.clientOf(board);
        const before=find(rows,id);
        const named=await attribution(board,before,input);
        const assigned=await assignment(actor,board,before,input);
        const {customValues:patch,contact:_contact,organization:_organization,...rest}=input;
        const custom=patch===undefined?{}:{customValues:applyCustomValues(await d.fields.list(actor.orgId,board,context),before.customValues,patch)};
        const links=await linked(context,actor,clientId,{name:input.name??before.name,personId:before.personId,companyId:before.companyId},input);
        touched=links.touched;
        const row=await d.leads.update(context,id,{...rest,...named,...assigned,...custom,personId:links.personId,companyId:links.companyId});
        await audit(context,actor,row,'UPDATE',{before,after:row});
        return row;
      });
      if (touched) await announce(actor,clientId,board);
      return updated;
    },
    async delete(actor:ActorContext,board:string,id:string) {
      const storageKeys=await mutation(actor,board,'delete',async(context,rows)=>{const row=find(rows,id); const keys=await d.leads.delete(context,id); await ordered(context,rows.filter(l=>l.stage===row.stage&&l.id!==id)); await audit(context,actor,row,'DELETE',{before:row}); return keys;});
      if (storageKeys.length>0) await d.storage.remove(storageKeys);
    },
    move(actor:ActorContext,board:string,id:string,input:{stage:string;position:number}) {
      return mutation(actor,board,'update',async(context,rows)=>{
        const before=find(rows,id);
        await placement(context,actor,board,input.stage);
        const target=rows.filter(l=>l.stage===input.stage&&l.id!==id);
        target.splice(Math.min(input.position,target.length),0,{...before,stage:input.stage,position:-1});
        await d.leads.update(context,id,{stage:input.stage});
        await ordered(context,target);
        if(before.stage!==input.stage) await ordered(context,rows.filter(l=>l.stage===before.stage&&l.id!==id));
        const result=await d.leads.list(actor,board,context);
        await audit(context,actor,find(result,id),'UPDATE',{before:{stage:before.stage,position:before.position},after:input});
        return result;
      });
    },
    async projectStageCounts(actor:ActorContext,range:{from:Date;to:Date}) {
      if (range.from.getTime()>range.to.getTime()) throw new AppError('validation','The range must start on or before its end');
      if (!can(actor,'read','lead')) throw new AppError('forbidden','Action not permitted');
      return d.leads.projectStageCounts(actor,arrivalWindow(range.from,range.to));
    },
    async boardStageCounts(actor:ActorContext,board:string,range:{from:Date;to:Date}) {
      if (range.from.getTime()>range.to.getTime()) throw new AppError('validation','The range must start on or before its end');
      await authorize(actor,board,'read');
      return d.leads.boardStageCounts(actor,board,arrivalWindow(range.from,range.to));
    },
    async columns(actor:ActorContext,board:string) { await authorize(actor,board,'read'); return boardColumns(await d.leads.columns(actor,board)); },
    createColumn(actor:ActorContext,board:string,input:{name:string;color?:OptionColor}) {
      return mutation(actor,board,'create',async context=>{
        const columns=await d.leads.columns(actor,board,context);
        if (columns.length>=CUSTOM_COLUMN_LIMIT) throw new AppError('validation',`A board holds at most ${CUSTOM_COLUMN_LIMIT} columns`);
        assertNameFree(columns,input.name);
        const afterStage=LEAD_STAGES[LEAD_STAGES.length-1];
        const position=columns.filter(column=>column.afterStage===afterStage).length;
        const column=await d.leads.createColumn(context,{id:d.ids.generate(),orgId:actor.orgId,projectId:board,name:input.name,afterStage,position,color:input.color??DEFAULT_COLUMN_COLOR});
        await auditColumn(context,actor,column,'CREATE',{after:column});
        return customColumnOf(column);
      });
    },
    updateColumn(actor:ActorContext,board:string,id:string,input:{name?:string;position?:number;color?:OptionColor}) {
      return mutation(actor,board,'update',async context=>{
        const columns=await d.leads.columns(actor,board,context);
        const before=customColumn(columns,id);
        if (input.name!==undefined) { assertNameFree(columns,input.name,id); await d.leads.updateColumn(context,id,{name:input.name}); }
        if (input.color!==undefined) await d.leads.updateColumn(context,id,{color:input.color});
        if (input.position!==undefined) {
          const full=boardColumns(columns);
          const moving=full.find(entry=>entry.id===id)!;
          const rest=full.filter(entry=>entry.id!==id);
          const at=Math.max(0,Math.min(input.position,rest.length));
          const target=[...rest.slice(0,at),moving,...rest.slice(at)];
          await repositionColumns(context,columns,target);
        }
        const result=await d.leads.columns(actor,board,context);
        await auditColumn(context,actor,before,'UPDATE',{before,after:customColumn(result,id)});
        return boardColumns(result);
      });
    },
    deleteColumn(actor:ActorContext,board:string,id:string) {
      return mutation(actor,board,'delete',async(context,rows)=>{
        const columns=await d.leads.columns(actor,board,context);
        const column=customColumn(columns,id);
        const moving=rows.filter(lead=>lead.stage===id);
        let position=rows.filter(lead=>lead.stage==='NEW').length;
        for (const lead of moving) await d.leads.update(context,lead.id,{stage:'NEW',position:position++});
        await d.leads.deleteColumn(context,id);
        await orderedColumns(context,columns.filter(candidate=>candidate.id!==id&&candidate.afterStage===column.afterStage));
        await auditColumn(context,actor,column,'DELETE',{before:column,movedLeadIds:moving.map(lead=>lead.id)});
      });
    },
  };
}
export type LeadUseCases=ReturnType<typeof createLeadUseCases>;
