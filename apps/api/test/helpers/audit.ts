import type { AuditAction } from "@prisma/client";
import { expect } from "vitest";
import { prisma } from "../../src/shared/infrastructure/prisma.js";

interface ExpectedAudit {
  action: AuditAction;
  entityType: string;
  entityId: string;
  clientId?: string | null;
  projectId?: string | null;
  campaignId?: string | null;
}

export async function expectAudit(expected: ExpectedAudit): Promise<void> {
  const events = await prisma.auditEvent.findMany({
    where: {
      action: expected.action,
      entityType: expected.entityType,
      entityId: expected.entityId,
    },
  });
  expect(events).toHaveLength(1);
  const context = Object.fromEntries(
    (["clientId", "projectId", "campaignId"] as const)
      .filter((key) => Object.hasOwn(expected, key))
      .map((key) => [key, expected[key] ?? null]),
  );
  expect(events[0]).toMatchObject(context);
}
