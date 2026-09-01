import { describe, expect, it, vi } from "vitest";
import type { TransactionContext } from "../../src/shared/application/unit-of-work.js";
import { PrismaUnitOfWork } from "../../src/shared/infrastructure/prisma-unit-of-work.js";

function transactionalFake() {
  const committed: string[] = [];
  const prisma = {
    async $transaction<T>(work: (client: { staged: string[] }) => Promise<T>): Promise<T> {
      const client = { staged: [] as string[] };
      const result = await work(client);
      committed.push(...client.staged);
      return result;
    },
  };
  return { prisma, committed };
}

describe("PrismaUnitOfWork", () => {
  it("commits work and returns its result", async () => {
    const { prisma, committed } = transactionalFake();
    const unitOfWork = new PrismaUnitOfWork(prisma);
    await expect(unitOfWork.run(async (context) => {
      unitOfWork.clientFor<{ staged: string[] }>(context).staged.push("business", "audit");
      return 42;
    })).resolves.toBe(42);
    expect(committed).toEqual(["business", "audit"]);
  });

  it("rolls back when work fails", async () => {
    const { prisma, committed } = transactionalFake();
    const unitOfWork = new PrismaUnitOfWork(prisma);
    await expect(unitOfWork.run(async (context) => {
      unitOfWork.clientFor<{ staged: string[] }>(context).staged.push("business");
      throw new Error("audit failed");
    })).rejects.toThrow("audit failed");
    expect(committed).toEqual([]);
  });

  it("rejects nested runs", async () => {
    const { prisma } = transactionalFake();
    const unitOfWork = new PrismaUnitOfWork(prisma);
    await expect(unitOfWork.run(() => unitOfWork.run(async () => undefined))).rejects.toThrow("Nested transactions are not supported");
  });

  it("rejects foreign and expired contexts", async () => {
    const { prisma } = transactionalFake();
    const unitOfWork = new PrismaUnitOfWork(prisma);
    expect(() => unitOfWork.clientFor({} as TransactionContext)).toThrow("Transaction context does not belong to this unit of work");
    let expired!: TransactionContext;
    await unitOfWork.run(async (context) => { expired = context; });
    expect(() => unitOfWork.clientFor(expired)).toThrow("Transaction context is no longer active");
  });

  it("propagates adapter failures without invoking work", async () => {
    const failure = new Error("database unavailable");
    const prisma = { $transaction: vi.fn().mockRejectedValue(failure) };
    const work = vi.fn();
    await expect(new PrismaUnitOfWork(prisma).run(work)).rejects.toBe(failure);
    expect(work).not.toHaveBeenCalled();
  });
});
