import type { PrismaClient } from "@prisma/client";
import type { CreativeStore } from "../application/ports.js";
import type { CreativeView, StoredCreative } from "../domain/snapshot.js";

const toView = (row: {
  id: string; position: number; kind: string; title: string | null; body: string | null;
  fileKey: string | null; posterKey: string | null;
}): CreativeView => ({
  id: row.id, position: row.position, kind: row.kind as CreativeView["kind"],
  title: row.title, body: row.body,
  hasFile: row.fileKey !== null, hasPoster: row.posterKey !== null,
});

export class PrismaCreativeStore implements CreativeStore {
  constructor(private readonly prisma: PrismaClient) {}

  async list(adId: string): Promise<CreativeView[]> {
    const rows = await this.prisma.adCreative.findMany({
      where: { adId }, orderBy: { position: "asc" },
    });
    return rows.map(toView);
  }

  async save(adId: string, creatives: readonly StoredCreative[]): Promise<CreativeView[]> {
    await this.prisma.$transaction(async (tx) => {
      await tx.adCreative.deleteMany({ where: { adId } });
      await tx.adCreative.createMany({
        data: creatives.map((creative) => ({
          adId, externalId: creative.creativeId, position: creative.position, kind: creative.kind,
          title: creative.title ?? null, body: creative.body ?? null,
          fileKey: creative.fileKey ?? null, contentType: creative.contentType ?? null,
          bytes: creative.bytes ?? null, posterKey: creative.posterKey ?? null,
          posterContentType: creative.posterContentType ?? null,
        })),
      });
    });
    return this.list(adId);
  }
}
