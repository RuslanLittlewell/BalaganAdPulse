import { can, type Action } from '@adpulse/access-policy';
import { AppError } from '#shared/domain/index.js';
import type { ActorContext, TransactionContext, UnitOfWork } from '#shared/application/index.js';
import type { LeadRecord } from '../domain/lead.js';
import type { LeadEvent, LeadRepository } from './ports.js';

export interface BoardMutationDependencies {
  leads: Pick<LeadRepository, 'reaches' | 'lock' | 'list'>;
  unitOfWork: UnitOfWork;
  publish: (event: LeadEvent) => void;
}

export function createBoardMutation(d: BoardMutationDependencies) {
  async function authorize(actor: ActorContext, board: string, action: Action) {
    if (!await d.leads.reaches(actor, board)) throw new AppError('not-found', 'Board not found');
    if (!can(actor, action, 'lead')) throw new AppError('forbidden', 'Action not permitted');
  }
  async function mutation<T>(actor: ActorContext, board: string, action: Action, work: (context: TransactionContext, rows: LeadRecord[]) => Promise<T>) {
    await authorize(actor, board, action);
    const result = await d.unitOfWork.run(async context => {
      await d.leads.lock(context, actor, board);
      await authorize(actor, board, action);
      return work(context, await d.leads.list(actor, board, context));
    });
    d.publish({ kind: 'crm.changed', orgId: actor.orgId, board });
    return result;
  }
  return { authorize, mutation };
}
