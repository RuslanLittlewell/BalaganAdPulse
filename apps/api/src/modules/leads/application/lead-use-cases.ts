import { can, type Action } from '@adpulse/access-policy';
import { AppError } from '#shared/domain/index.js';
import type { ActorContext, IdGenerator, UnitOfWork, TransactionContext } from '#shared/application/index.js';
import type { AuditWriter } from '../../audit/index.js';
import { arrivalWindow, boardColumns, customColumnOf, CUSTOM_COLUMN_LIMIT, isLeadStage, LEAD_STAGE_NAMES, LEAD_STAGES, type BoardColumn, type LeadColumnRecord, type LeadFields, type LeadRecord, type LeadStage } from '../domain/lead.js';
import type { LeadRepository, LeadEvent } from './ports.js';

export function createLeadUseCases(d: {leads:LeadRepository; audit:AuditWriter; ids:IdGenerator; unitOfWork:UnitOfWork; publish:(event:LeadEvent)=>void}) {
  async function authorize(actor:ActorContext, board:string, action:Action) {
    if (!await d.leads.reaches(actor,board)) throw new AppError('not-found','Board not found');
    if (!can(actor,action,'lead')) throw new AppError('forbidden','Action not permitted');
  }
  async function attribution(actor:ActorContext, board:string, before:Pick<LeadRecord,'projectId'|'campaignId'|'origin'>, input:Partial<LeadFields>) {
    if (before.origin==='META') {
      const changes=(key:'projectId'|'campaignId')=>input[key]!==undefined&&input[key]!==before[key];
      if (changes('projectId')||changes('campaignId')) throw new AppError('validation','An imported lead keeps the project and campaign it came from');
      return {projectId:before.projectId,campaignId:before.campaignId};
    }
    const projectId = input.projectId === undefined ? before.projectId : input.projectId;
    if (projectId && !await d.leads.reachesProject(actor,board,projectId)) {
      throw new AppError('not-found','Project not found');
    }
    const asked = input.campaignId === undefined ? undefined : input.campaignId;
    const campaignId = asked === undefined
      ? (before.campaignId && projectId === before.projectId ? before.campaignId : null)
      : asked;
    if (campaignId) {
      if (!projectId) throw new AppError('validation','A campaign needs the project it belongs to');
      if (!await d.leads.campaignInProject(campaignId,projectId)) {
        throw new AppError('validation','That campaign belongs to another project');
      }
    }
    return {projectId,campaignId};
  }
  async function assignment(actor:ActorContext,board:string,before:Pick<LeadRecord,'assigneeId'>,input:Partial<LeadFields>,projectId:string|null) {
    const assigneeId=input.assigneeId===undefined?before.assigneeId:input.assigneeId;
    if (assigneeId&&!await d.leads.assigneeReachesBoard(actor.orgId,assigneeId,board,projectId)) {
      throw new AppError('validation','The assignee is not an active member of this client');
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
  async function mutation<T>(actor:ActorContext, board:string, action:Action, work:(context:TransactionContext,rows:LeadRecord[])=>Promise<T>) {
    await authorize(actor,board,action);
    const result=await d.unitOfWork.run(async context=> {
      await d.leads.lock(context,actor,board);
      await authorize(actor,board,action);
      return work(context,await d.leads.list(actor,board,context));
    });
    d.publish({kind:'crm.changed',orgId:actor.orgId,board});
    return result;
  }
  async function audit(context:TransactionContext,actor:ActorContext,row:LeadRecord,action:'CREATE'|'UPDATE'|'DELETE',changes:unknown) {
    const withoutSource=(value:unknown)=>value&&typeof value==='object'&&'metaSource' in value?{...value,metaSource:undefined,ad:undefined}:value;
    const trimmed=Object.fromEntries(Object.entries(changes as Record<string,unknown>).map(([key,value])=>[key,withoutSource(value)]));
    await d.audit.append(context,{action,entityType:'lead',entityId:row.id,clientId:row.clientId,summary:`${action} lead`,changes:JSON.parse(JSON.stringify(trimmed))},actor);
  }
  async function auditColumn(context:TransactionContext,actor:ActorContext,column:LeadColumnRecord,action:'CREATE'|'UPDATE'|'DELETE',changes:unknown) {
    await d.audit.append(context,{action,entityType:'lead-column',entityId:column.id,clientId:column.clientId,summary:`${action} lead column`,changes:JSON.parse(JSON.stringify(changes))},actor);
  }
  return {
    async boards(actor:ActorContext) { return (await d.leads.boards(actor)).map(b=>({...b,capabilities:{create:can(actor,'create','lead'),update:can(actor,'update','lead'),delete:can(actor,'delete','lead')}})); },
    async list(actor:ActorContext,board:string) { await authorize(actor,board,'read'); return d.leads.list(actor,board); },
    async read(actor:ActorContext,board:string,id:string) { await authorize(actor,board,'read'); return find(await d.leads.list(actor,board),id); },
    create(actor:ActorContext,board:string,input:LeadFields & {stage?:string}) {
      return mutation(actor,board,'create',async (context,rows)=> {
        const stage=input.stage ?? 'NEW';
        await placement(context,actor,board,stage);
        const named=await attribution(actor,board,{projectId:null,campaignId:null,origin:'MANUAL'},input);
        const assigned=await assignment(actor,board,{assigneeId:null},input,named.projectId);
        const row=await d.leads.create(context,{...input,...named,...assigned,id:d.ids.generate(),orgId:actor.orgId,clientId:board==='agency'?null:board,stage,position:0});
        await ordered(context,[{...row,position:-1},...rows.filter(l=>l.stage===stage)]);
        await audit(context,actor,row,'CREATE',{after:row}); return row;
      });
    },
    update(actor:ActorContext,board:string,id:string,input:Partial<LeadFields>) {
      return mutation(actor,board,'update',async(context,rows)=>{
        const before=find(rows,id);
        const named=await attribution(actor,board,before,input);
        const assigned=await assignment(actor,board,before,input,named.projectId);
        const row=await d.leads.update(context,id,{...input,...named,...assigned});
        await audit(context,actor,row,'UPDATE',{before,after:row});
        return row;
      });
    },
    delete(actor:ActorContext,board:string,id:string) {
      return mutation(actor,board,'delete',async(context,rows)=>{const row=find(rows,id); await d.leads.delete(context,id); await ordered(context,rows.filter(l=>l.stage===row.stage&&l.id!==id)); await audit(context,actor,row,'DELETE',{before:row});});
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
    async columns(actor:ActorContext,board:string) { await authorize(actor,board,'read'); return boardColumns(await d.leads.columns(actor,board)); },
    createColumn(actor:ActorContext,board:string,input:{name:string}) {
      return mutation(actor,board,'create',async context=>{
        const columns=await d.leads.columns(actor,board,context);
        if (columns.length>=CUSTOM_COLUMN_LIMIT) throw new AppError('validation',`A board holds at most ${CUSTOM_COLUMN_LIMIT} columns`);
        assertNameFree(columns,input.name);
        const afterStage=LEAD_STAGES[LEAD_STAGES.length-1];
        const position=columns.filter(column=>column.afterStage===afterStage).length;
        const column=await d.leads.createColumn(context,{id:d.ids.generate(),orgId:actor.orgId,clientId:board==='agency'?null:board,name:input.name,afterStage,position});
        await auditColumn(context,actor,column,'CREATE',{after:column});
        return customColumnOf(column);
      });
    },
    updateColumn(actor:ActorContext,board:string,id:string,input:{name?:string;position?:number}) {
      return mutation(actor,board,'update',async context=>{
        const columns=await d.leads.columns(actor,board,context);
        const before=customColumn(columns,id);
        if (input.name!==undefined) { assertNameFree(columns,input.name,id); await d.leads.updateColumn(context,id,{name:input.name}); }
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
