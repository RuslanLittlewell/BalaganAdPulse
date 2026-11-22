export const FAILURES_PER_ROUND = 3;
export const FIRST_LOCK_MS = 15 * 60_000;
export const SECOND_LOCK_MS = 30 * 60_000;
export const SIGN_IN_LOCKED = "SIGN_IN_LOCKED";
export const PASSWORD_RESET_REQUIRED = "PASSWORD_RESET_REQUIRED";

export interface SignInLockState {
  readonly failures: number;
  readonly round: number;
  readonly lockedUntil: Date | null;
  readonly resetRequired: boolean;
}

export function signInLockKey(userId: string): string {
  return `user:${userId}`;
}

export function unknownLoginKey(login: string): string {
  return `login:${login.trim().toLowerCase()}`;
}

export function lockDurationMs(round: number): number {
  return round === 0 ? FIRST_LOCK_MS : SECOND_LOCK_MS;
}
