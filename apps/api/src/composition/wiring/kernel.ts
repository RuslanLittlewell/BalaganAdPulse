import type { Prisma } from "@prisma/client";
import { prisma } from "#shared/infrastructure/prisma.js";
import { PrismaUnitOfWork } from "#shared/infrastructure/prisma-unit-of-work.js";
import { RandomIdGenerator } from "#shared/infrastructure/id-generator.js";
import { SystemClock } from "#shared/infrastructure/clock.js";
import { createAuditReader, createAuditWriter } from "#modules/audit/index.js";
import {
  PrismaActorSnapshots,
  PrismaAuditReach,
  PrismaAuditRepository,
} from "#modules/audit/infrastructure/prisma-audit-repository.js";
import { AmbientRequestMetadata } from "#modules/audit/infrastructure/request-metadata.js";
import { createConnectionRegistry } from "#modules/realtime/index.js";

export function createKernel() {
  const unitOfWork = new PrismaUnitOfWork<Prisma.TransactionClient>(prisma);
  const auditDependencies = {
    events: new PrismaAuditRepository(prisma, unitOfWork),
    reach: new PrismaAuditReach(prisma),
    metadata: new AmbientRequestMetadata(),
    snapshots: new PrismaActorSnapshots(unitOfWork),
  };
  return {
    unitOfWork,
    clock: new SystemClock(),
    ids: new RandomIdGenerator(),
    audit: createAuditWriter(auditDependencies),
    auditReader: createAuditReader(auditDependencies),
    connections: createConnectionRegistry(),
  };
}

export type Kernel = ReturnType<typeof createKernel>;

export function runDetached(failure: string, work: Promise<unknown>): void {
  void work.catch((error: unknown) => {
    console.error(failure, error);
  });
}
