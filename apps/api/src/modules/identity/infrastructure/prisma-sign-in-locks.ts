import { Prisma, type PrismaClient } from "@prisma/client";
import type { TransactionContext } from "#shared/application/index.js";
import type { PrismaUnitOfWork } from "#shared/infrastructure/prisma-unit-of-work.js";
import type { SignInAttempt, SignInLockRepository } from "../application/ports.js";
import { FIRST_LOCK_MS, SECOND_LOCK_MS, type SignInLockState } from "../domain/sign-in-lock.js";

const STALE_UNKNOWN_MS = 30 * 24 * 60 * 60_000;

interface LockRow {
  failures: number;
  round: number;
  locked_until: Date | null;
  reset_required: boolean;
}

const stateOf = (row: LockRow): SignInLockState => ({
  failures: row.failures,
  round: row.round,
  lockedUntil: row.locked_until,
  resetRequired: row.reset_required,
});

const iso = (date: Date) => date.toISOString();

export class PrismaSignInLocks implements SignInLockRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly unitOfWork: PrismaUnitOfWork<Prisma.TransactionClient>,
  ) {}

  async reserve(key: string, now: Date, failuresPerRound: number): Promise<SignInAttempt> {
    const [reserved] = await this.prisma.$queryRaw<LockRow[]>`
      INSERT INTO sign_in_lock (key, failures, round, reset_required, updated_at)
      VALUES (${key}, 1, 0, false, ${iso(now)}::timestamp)
      ON CONFLICT (key) DO UPDATE
        SET failures = sign_in_lock.failures + 1, updated_at = EXCLUDED.updated_at
        WHERE NOT sign_in_lock.reset_required
          AND (sign_in_lock.locked_until IS NULL OR sign_in_lock.locked_until <= EXCLUDED.updated_at)
          AND sign_in_lock.failures < ${failuresPerRound}
      RETURNING failures, round, locked_until, reset_required`;
    if (reserved) return { allowed: true, failures: reserved.failures };
    const [held] = await this.prisma.$queryRaw<LockRow[]>`
      SELECT failures, round, locked_until, reset_required FROM sign_in_lock WHERE key = ${key}`;
    return { allowed: false, state: held ? stateOf(held) : null };
  }

  async lock(key: string, now: Date): Promise<SignInLockState> {
    const [locked] = await this.prisma.$queryRaw<LockRow[]>`
      UPDATE sign_in_lock SET
        failures = 0,
        round = LEAST(round + 1, 2),
        locked_until = ${iso(now)}::timestamp + make_interval(secs => CASE WHEN round = 0 THEN ${FIRST_LOCK_MS / 1000} ELSE ${SECOND_LOCK_MS / 1000} END),
        reset_required = reset_required OR round >= 1,
        updated_at = ${iso(now)}::timestamp
      WHERE key = ${key}
      RETURNING failures, round, locked_until, reset_required`;
    await this.prisma.$executeRaw`
      DELETE FROM sign_in_lock WHERE key LIKE 'login:%' AND updated_at < ${iso(new Date(now.getTime() - STALE_UNKNOWN_MS))}::timestamp`;
    return locked ? stateOf(locked) : { failures: 0, round: 1, lockedUntil: new Date(now.getTime() + FIRST_LOCK_MS), resetRequired: false };
  }

  async release(key: string): Promise<void> {
    await this.prisma.$executeRaw`UPDATE sign_in_lock SET failures = GREATEST(failures - 1, 0) WHERE key = ${key}`;
  }

  async clear(key: string, context?: TransactionContext): Promise<void> {
    const client = context ? this.unitOfWork.clientFor<Prisma.TransactionClient>(context) : this.prisma;
    await client.signInLock.deleteMany({ where: { key } });
  }
}
