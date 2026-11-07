import type { Prisma, PrismaClient } from '@prisma/client';
import type { TransactionContext } from '#shared/application/index.js';
import type { PrismaUnitOfWork } from '#shared/infrastructure/prisma-unit-of-work.js';
import type { LeadFieldRepository } from '../application/ports.js';
import type { FieldOption, LeadFieldRecord } from '../domain/lead-field.js';

const fieldInclude = {project:{select:{clientId:true}}} satisfies Prisma.LeadFieldInclude;
type FieldRow = Prisma.LeadFieldGetPayload<{include:typeof fieldInclude}>;

const toFieldRecord = ({project, options, ...field}: FieldRow): LeadFieldRecord =>
  ({...field, options:Array.isArray(options) ? options as unknown as FieldOption[] : [], clientId:project.clientId});

const jsonOf = (options: FieldOption[]) => options as unknown as Prisma.InputJsonArray;

export class PrismaLeadFieldRepository implements LeadFieldRepository {
  constructor(private readonly prisma: PrismaClient, private readonly uow: PrismaUnitOfWork<Prisma.TransactionClient>) {}
  async list(orgId: string, board: string, context?: TransactionContext) {
    const client = context ? this.uow.clientFor<Prisma.TransactionClient>(context) : this.prisma;
    const rows = await client.leadField.findMany({where:{orgId, projectId:board}, include:fieldInclude, orderBy:[{position:'asc'}, {id:'asc'}]});
    return rows.map(toFieldRecord);
  }
  async create(context: TransactionContext, {options, ...input}: Parameters<LeadFieldRepository['create']>[1]) {
    return toFieldRecord(await this.uow.clientFor<Prisma.TransactionClient>(context).leadField.create({data:{...input, options:jsonOf(options)}, include:fieldInclude}));
  }
  async update(context: TransactionContext, id: string, {options, ...input}: Parameters<LeadFieldRepository['update']>[2]) {
    return toFieldRecord(await this.uow.clientFor<Prisma.TransactionClient>(context).leadField.update({
      where:{id}, data:{...input, ...(options === undefined ? {} : {options:jsonOf(options)})}, include:fieldInclude,
    }));
  }
  async delete(context: TransactionContext, id: string) {
    await this.uow.clientFor<Prisma.TransactionClient>(context).leadField.delete({where:{id}});
  }
}
