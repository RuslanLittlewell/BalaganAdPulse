import type { Prisma, PrismaClient } from '@prisma/client';
import type { LeadNoteRepository } from '../application/ports.js';
import type { LeadNoteRecord } from '../domain/lead-note.js';

const include = { author: { select: { id: true, user: { select: { name: true } } } } } satisfies Prisma.LeadNoteInclude;
type NoteRow = Prisma.LeadNoteGetPayload<{ include: typeof include }>;

const toRecord = ({ author, orgId: _orgId, authorId: _authorId, ...note }: NoteRow): LeadNoteRecord => ({
  ...note,
  author: author && { id: author.id, name: author.user.name },
});

export class PrismaLeadNoteRepository implements LeadNoteRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async list(leadId: string) {
    const rows = await this.prisma.leadNote.findMany({ where: { leadId }, include, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
    return rows.map(toRecord);
  }

  async find(leadId: string, id: string) {
    const row = await this.prisma.leadNote.findFirst({ where: { id, leadId }, include });
    return row && toRecord(row);
  }

  async create(input: Parameters<LeadNoteRepository['create']>[0]) {
    return toRecord(await this.prisma.leadNote.create({ data: input, include }));
  }

  async edit(id: string, changes: { body: string; editedAt: Date }) {
    return toRecord(await this.prisma.leadNote.update({ where: { id }, data: changes, include }));
  }

  async delete(id: string) {
    await this.prisma.leadNote.delete({ where: { id } });
  }
}
