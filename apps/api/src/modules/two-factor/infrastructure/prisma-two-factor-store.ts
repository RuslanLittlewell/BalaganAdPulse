import type { PrismaClient } from "@prisma/client";
import type { TwoFactorStore } from "../application/ports.js";
import type { TrustedAddressRecord, TwoFactorRecord } from "../domain/two-factor.js";

const EMPLOYEE_ROLES = ["ADMIN", "MANAGER", "GUEST"] as const;
const iso = (date: Date) => date.toISOString();

export class PrismaTwoFactorStore implements TwoFactorStore {
  constructor(private readonly prisma: PrismaClient) {}

  async find(userId: string): Promise<TwoFactorRecord | null> {
    return this.prisma.twoFactor.findUnique({
      where: { userId },
      select: { sealedSecret: true, sealedPending: true, enabledAt: true, lastStep: true },
    });
  }

  async savePending(userId: string, sealedPending: string) {
    await this.prisma.twoFactor.upsert({ where: { userId }, create: { userId, sealedPending }, update: { sealedPending } });
  }

  async enable(userId: string, change: { sealedSecret: string; step: number; backupHashes: readonly string[]; address: string; now: Date }) {
    await this.prisma.$transaction([
      this.prisma.twoFactor.update({
        where: { userId },
        data: { sealedSecret: change.sealedSecret, sealedPending: null, enabledAt: change.now, lastStep: change.step },
      }),
      this.prisma.twoFactorBackupCode.deleteMany({ where: { userId } }),
      this.prisma.twoFactorBackupCode.createMany({ data: change.backupHashes.map((codeHash) => ({ userId, codeHash })) }),
      this.prisma.trustedAddress.upsert({
        where: { userId_address: { userId, address: change.address } },
        create: { userId, address: change.address, confirmedAt: change.now, lastUsedAt: change.now },
        update: { lastUsedAt: change.now },
      }),
    ]);
  }

  async spendStep(userId: string, step: number) {
    const spent = await this.prisma.$executeRaw`
      UPDATE two_factor SET last_step = ${step}, updated_at = now()
      WHERE user_id = ${userId} AND enabled_at IS NOT NULL AND (last_step IS NULL OR last_step < ${step})`;
    return spent === 1;
  }

  async spendBackupCode(userId: string, hash: string, now: Date) {
    const { count } = await this.prisma.twoFactorBackupCode.updateMany({ where: { userId, codeHash: hash, usedAt: null }, data: { usedAt: now } });
    return count === 1;
  }

  async replaceBackupCodes(userId: string, hashes: readonly string[]) {
    await this.prisma.$transaction([
      this.prisma.twoFactorBackupCode.deleteMany({ where: { userId } }),
      this.prisma.twoFactorBackupCode.createMany({ data: hashes.map((codeHash) => ({ userId, codeHash })) }),
    ]);
  }

  backupCodesLeft(userId: string) {
    return this.prisma.twoFactorBackupCode.count({ where: { userId, usedAt: null } });
  }

  async remove(userId: string) {
    await this.prisma.$transaction([
      this.prisma.twoFactor.deleteMany({ where: { userId } }),
      this.prisma.twoFactorBackupCode.deleteMany({ where: { userId } }),
      this.prisma.trustedAddress.deleteMany({ where: { userId } }),
      this.prisma.twoFactorChallenge.deleteMany({ where: { userId } }),
    ]);
  }

  async isTrusted(userId: string, address: string, now: Date) {
    const { count } = await this.prisma.trustedAddress.updateMany({ where: { userId, address }, data: { lastUsedAt: now } });
    return count > 0;
  }

  async trust(userId: string, address: string, now: Date) {
    await this.prisma.trustedAddress.upsert({
      where: { userId_address: { userId, address } },
      create: { userId, address, confirmedAt: now, lastUsedAt: now },
      update: { lastUsedAt: now },
    });
  }

  addresses(userId: string): Promise<TrustedAddressRecord[]> {
    return this.prisma.trustedAddress.findMany({
      where: { userId },
      orderBy: { lastUsedAt: "desc" },
      select: { id: true, address: true, confirmedAt: true, lastUsedAt: true },
    });
  }

  async forget(userId: string, id: string) {
    const { count } = await this.prisma.trustedAddress.deleteMany({ where: { userId, id } });
    return count > 0;
  }

  async forgetAll(userId: string) {
    await this.prisma.trustedAddress.deleteMany({ where: { userId } });
  }

  async openChallenge(tokenHash: string, userId: string, expiresAt: Date) {
    await this.prisma.$transaction([
      this.prisma.twoFactorChallenge.deleteMany({ where: { userId, expiresAt: { lt: new Date() } } }),
      this.prisma.twoFactorChallenge.create({ data: { tokenHash, userId, expiresAt } }),
    ]);
  }

  async challenge(tokenHash: string, now: Date) {
    const rows = await this.prisma.$queryRaw<Array<{ user_id: string }>>`
      SELECT user_id FROM two_factor_challenge WHERE token_hash = ${tokenHash} AND expires_at > ${iso(now)}::timestamp`;
    return rows[0] ? { userId: rows[0].user_id } : null;
  }

  async closeChallenge(tokenHash: string) {
    await this.prisma.twoFactorChallenge.deleteMany({ where: { tokenHash } });
  }

  async employeeRequirement(userId: string) {
    const count = await this.prisma.membership.count({
      where: { userId, status: "ACTIVE", role: { in: [...EMPLOYEE_ROLES] }, org: { requireTwoFactor: true } },
    });
    return count > 0;
  }

  async organizationRequirement(orgId: string) {
    return (await this.prisma.organization.findUnique({ where: { id: orgId }, select: { requireTwoFactor: true } }))?.requireTwoFactor ?? false;
  }

  async setOrganizationRequirement(orgId: string, required: boolean) {
    await this.prisma.organization.update({ where: { id: orgId }, data: { requireTwoFactor: required } });
  }

  async enrolledMemberships(orgId: string) {
    const rows = await this.prisma.membership.findMany({
      where: { orgId, user: { twoFactor: { enabledAt: { not: null } } } },
      select: { id: true },
    });
    return rows.map((row) => row.id);
  }

  async memberOf(orgId: string, membershipId: string) {
    const row = await this.prisma.membership.findFirst({
      where: { id: membershipId, orgId },
      select: { userId: true, user: { select: { name: true } } },
    });
    return row && { userId: row.userId, name: row.user.name };
  }

  async userByEmail(email: string) {
    const row = await this.prisma.user.findFirst({
      where: { email: { equals: email.trim(), mode: "insensitive" } },
      select: { id: true, memberships: { select: { orgId: true }, take: 1 } },
    });
    return row && { id: row.id, orgId: row.memberships[0]?.orgId ?? null };
  }

  async accountName(userId: string) {
    return (await this.prisma.user.findUnique({ where: { id: userId }, select: { name: true } }))?.name ?? "";
  }
}
