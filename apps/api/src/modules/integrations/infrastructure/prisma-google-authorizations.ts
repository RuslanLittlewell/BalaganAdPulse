import type { PrismaClient } from "@prisma/client";
import type { GoogleAuthorizationRecord, GoogleAuthorizations } from "../application/google-use-cases.js";

const record = { id: true, projectId: true, userId: true, integrationId: true, encryptedRefreshToken: true } as const;

export class PrismaGoogleAuthorizations implements GoogleAuthorizations {
  constructor(private readonly prisma: PrismaClient) {}

  async open(
    data: { projectId: string; userId: string; integrationId: string | null },
    now: Date,
    expiresAt: Date,
  ): Promise<GoogleAuthorizationRecord> {
    await this.prisma.googleAuthorization.deleteMany({ where: { expiresAt: { lt: now } } });
    return this.prisma.googleAuthorization.create({ data: { ...data, expiresAt }, select: record });
  }

  read(id: string, now: Date): Promise<GoogleAuthorizationRecord | null> {
    return this.prisma.googleAuthorization.findFirst({ where: { id, expiresAt: { gt: now } }, select: record });
  }

  async grant(id: string, encryptedRefreshToken: string, now: Date, expiresAt: Date): Promise<boolean> {
    const updated = await this.prisma.googleAuthorization.updateMany({
      where: { id, encryptedRefreshToken: null, expiresAt: { gt: now } },
      data: { encryptedRefreshToken, expiresAt },
    });
    return updated.count === 1;
  }

  async close(id: string): Promise<void> {
    await this.prisma.googleAuthorization.deleteMany({ where: { id } });
  }
}
