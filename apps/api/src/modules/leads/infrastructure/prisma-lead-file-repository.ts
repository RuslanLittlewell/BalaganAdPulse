import type { Prisma, PrismaClient } from '@prisma/client';
import type { TransactionContext } from '#shared/application/index.js';
import type { PrismaUnitOfWork } from '#shared/infrastructure/prisma-unit-of-work.js';
import { getObject, putObject, removeObjects } from '#shared/infrastructure/storage.js';
import type { LeadFileRepository, LeadFileStorage } from '../application/ports.js';
import type { LeadFileRecord, StoredLeadFile } from '../domain/lead-file.js';

const fileInclude = { uploader: { select: { id: true, user: { select: { name: true } } } } } satisfies Prisma.LeadFileInclude;
type FileRow = Prisma.LeadFileGetPayload<{ include: typeof fileInclude }>;

const toStored = ({ uploader, orgId: _orgId, uploaderId: _uploaderId, ...file }: FileRow): StoredLeadFile => ({
  ...file,
  uploader: uploader && { id: uploader.id, name: uploader.user.name },
});
const toRecord = (row: FileRow): LeadFileRecord => {
  const { storageKey: _storageKey, ...record } = toStored(row);
  return record;
};

export class PrismaLeadFileRepository implements LeadFileRepository {
  constructor(private readonly prisma: PrismaClient, private readonly uow: PrismaUnitOfWork<Prisma.TransactionClient>) {}

  async list(leadId: string) {
    const rows = await this.prisma.leadFile.findMany({ where: { leadId }, include: fileInclude, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
    return rows.map(toRecord);
  }

  async find(leadId: string, id: string) {
    const row = await this.prisma.leadFile.findFirst({ where: { id, leadId }, include: fileInclude });
    return row && toStored(row);
  }

  async create(context: TransactionContext, input: Parameters<LeadFileRepository['create']>[1]) {
    return toRecord(await this.uow.clientFor<Prisma.TransactionClient>(context).leadFile.create({ data: input, include: fileInclude }));
  }

  async delete(context: TransactionContext, id: string) {
    await this.uow.clientFor<Prisma.TransactionClient>(context).leadFile.delete({ where: { id } });
  }
}

export class S3LeadFileStorage implements LeadFileStorage {
  put(key: string, bytes: Buffer, contentType: string) {
    return putObject(key, bytes, contentType);
  }

  get(key: string) {
    return getObject(key);
  }

  remove(keys: readonly string[]) {
    return removeObjects(keys);
  }
}
