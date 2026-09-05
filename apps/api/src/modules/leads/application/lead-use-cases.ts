import { can, type Action } from '@adpulse/access-policy';
import { AppError } from '#shared/domain/index.js';
import type { ActorContext, IdGenerator, UnitOfWork, TransactionContext } from '#shared/application/index.js';
import type { AuditWriter } from '../../audit/index.js';
import type { LeadFields, LeadRecord, LeadStage } from '../domain/lead.js';
import type { LeadRepository, LeadEvent } from './ports.js';

export function createLeadUseCases(d: {leads:LeadRepository; audit:AuditWriter; ids:IdGenerator; unitOfWork:UnitOfWork; publish:(event:LeadEvent)=>void}) {
  async function authorize(actor:ActorContext, board:string, action:Action) {
    if (!await d.leads.reaches(actor,board)) throw new AppError('not-found','Board not found');
    if (!can(actor,action,'lead')) throw new AppError('forbidden','Action not permitted');
  }
  async function attribution(actor:ActorContext, board:string, before:{projectId:string|null;campaignId:string|null}, input:Partial<LeadFields>) {
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
  function find(rows:LeadRecord[],id:string) {
    const row=rows.find(l=>l.id===id); if (!row) throw new AppError('not-found','Lead not found'); return row;
  }
  async function ordered(context:TransactionContext, rows:LeadRecord[]) {
    for (const [position,row] of rows.entries()) if(row.position!==position) await d.leads.update(context,row.id,{position});
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
    await d.audit.append(context,{action,entityType:'lead',entityId:row.id,clientId:row.clientId,summary:`${action} lead`,changes:JSON.parse(JSON.stringify(changes))},actor);
  }
  return {
    async boards(actor:ActorContext) { return (await d.leads.boards(actor)).map(b=>({...b,capabilities:{create:can(actor,'create','lead'),update:can(actor,'update','lead'),delete:can(actor,'delete','lead')}})); },
    async list(actor:ActorContext,board:string) { await authorize(actor,board,'read'); return d.leads.list(actor,board); },
    async read(actor:ActorContext,board:string,id:string) { await authorize(actor,board,'read'); return find(await d.leads.list(actor,board),id); },
    create(actor:ActorContext,board:string,input:LeadFields & {stage?:LeadStage}) {
      return mutation(actor,board,'create',async (context,rows)=> {
        const stage=input.stage ?? 'NEW';
        const named=await attribution(actor,board,{projectId:null,campaignId:null},input);
        const row=await d.leads.create(context,{...input,...named,id:d.ids.generate(),orgId:actor.orgId,clientId:board==='agency'?null:board,stage,position:rows.filter(l=>l.stage===stage).length});
        await audit(context,actor,row,'CREATE',{after:row}); return row;
      });
    },
    update(actor:ActorContext,board:string,id:string,input:Partial<LeadFields>) {
      return mutation(actor,board,'update',async(context,rows)=>{
        const before=find(rows,id);
        const named=await attribution(actor,board,before,input);
        const row=await d.leads.update(context,id,{...input,...named});
        await audit(context,actor,row,'UPDATE',{before,after:row});
        return row;
      });
    },
    delete(actor:ActorContext,board:string,id:string) {
      return mutation(actor,board,'delete',async(context,rows)=>{const row=find(rows,id); await d.leads.delete(context,id); await ordered(context,rows.filter(l=>l.stage===row.stage&&l.id!==id)); await audit(context,actor,row,'DELETE',{before:row});});
    },
    move(actor:ActorContext,board:string,id:string,input:{stage:LeadStage;position:number}) {
      return mutation(actor,board,'update',async(context,rows)=>{
        const before=find(rows,id);
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
  };
}
export type LeadUseCases=ReturnType<typeof createLeadUseCases>;
