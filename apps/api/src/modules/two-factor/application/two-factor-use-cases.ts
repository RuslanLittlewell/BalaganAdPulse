import { can } from "@adpulse/access-policy";
import { AppError } from "#shared/domain/index.js";
import type { ActorContext } from "#shared/application/index.js";
import {
  BACKUP_CODE_COUNT,
  CHALLENGE_EXPIRED,
  CHALLENGE_MS,
  ISSUER,
  TWO_FACTOR_SETUP_REQUIRED,
  isAppCode,
  isEmployee,
  normalizeCode,
} from "../domain/two-factor.js";
import type { TwoFactorDependencies } from "./ports.js";

export interface Principal {
  readonly id: string;
  readonly name: string;
  readonly email: string | null;
}

export const INVALID_CODE = "The code is not valid";
export const TWO_FACTOR_REQUIRED_MESSAGE = "Set up two-factor sign-in to continue";

export function createTwoFactorUseCases(d: TwoFactorDependencies) {
  const enabledRecord = async (userId: string) => {
    const record = await d.store.find(userId);
    return record?.enabledAt && record.sealedSecret ? record : null;
  };

  const verifyAppCode = async (userId: string, code: string): Promise<boolean> => {
    const record = await enabledRecord(userId);
    if (!record) return false;
    const step = d.totp.verify(d.secrets.unseal(record.sealedSecret!, userId), code, d.clock.now(), record.lastStep);
    return step !== null && d.store.spendStep(userId, step);
  };

  const verifyFactor = async (userId: string, raw: string): Promise<boolean> => {
    const code = normalizeCode(raw);
    if (isAppCode(code)) return verifyAppCode(userId, code);
    if (code.length !== 10) return false;
    return d.store.spendBackupCode(userId, d.secrets.hash(code), d.clock.now());
  };

  const issueBackupCodes = () => {
    const codes = d.secrets.newBackupCodes(BACKUP_CODE_COUNT);
    return { codes, hashes: codes.map((code) => d.secrets.hash(code)) };
  };

  const requireCode = async (verify: Promise<boolean>) => {
    if (!(await verify)) throw new AppError("validation", INVALID_CODE, [{ code: "INVALID_CODE" }]);
  };

  const reset = async (userId: string) => {
    await d.store.remove(userId);
    await d.sessions.endSessions(userId);
  };

  return {
    async status(principal: Principal) {
      const [record, required, left] = await Promise.all([
        d.store.find(principal.id),
        d.store.employeeRequirement(principal.id),
        d.store.backupCodesLeft(principal.id),
      ]);
      return { enabled: Boolean(record?.enabledAt), required, backupCodesLeft: left };
    },

    async startSetup(principal: Principal) {
      if (await enabledRecord(principal.id)) throw new AppError("conflict", "Two-factor sign-in is already on");
      const secret = d.totp.newSecret();
      await d.store.savePending(principal.id, d.secrets.seal(secret, principal.id));
      const uri = d.totp.uri(secret, principal.email ?? principal.name, ISSUER);
      return { key: secret, uri, qrSvg: await d.qr.svg(uri) };
    },

    async confirmSetup(principal: Principal, raw: string, address: string) {
      const record = await d.store.find(principal.id);
      if (record?.enabledAt) throw new AppError("conflict", "Two-factor sign-in is already on");
      if (!record?.sealedPending) throw new AppError("validation", "Start the setup first");
      const code = normalizeCode(raw);
      const now = d.clock.now();
      const step = isAppCode(code) ? d.totp.verify(d.secrets.unseal(record.sealedPending, principal.id), code, now, null) : null;
      if (step === null) throw new AppError("validation", INVALID_CODE, [{ code: "INVALID_CODE" }]);
      const { codes, hashes } = issueBackupCodes();
      await d.store.enable(principal.id, { sealedSecret: record.sealedPending, step, backupHashes: hashes, address, now });
      return { backupCodes: codes };
    },

    async disable(principal: Principal, raw: string) {
      if (!(await enabledRecord(principal.id))) throw new AppError("not-found", "Two-factor sign-in is off");
      if (await d.store.employeeRequirement(principal.id)) {
        throw new AppError("forbidden", "The organization requires two-factor sign-in");
      }
      await requireCode(verifyFactor(principal.id, raw));
      await d.store.remove(principal.id);
    },

    async renewBackupCodes(principal: Principal, raw: string) {
      if (!(await enabledRecord(principal.id))) throw new AppError("not-found", "Two-factor sign-in is off");
      const code = normalizeCode(raw);
      await requireCode(isAppCode(code) ? verifyAppCode(principal.id, code) : Promise.resolve(false));
      const { codes, hashes } = issueBackupCodes();
      await d.store.replaceBackupCodes(principal.id, hashes);
      return { backupCodes: codes };
    },

    addresses(principal: Principal) {
      return d.store.addresses(principal.id);
    },

    async forget(principal: Principal, id: string) {
      if (!(await d.store.forget(principal.id, id))) throw new AppError("not-found", "Address not found");
    },

    forgetAll(principal: Principal) {
      return d.store.forgetAll(principal.id);
    },

    async needed(userId: string, address: string): Promise<boolean> {
      if (!(await enabledRecord(userId))) return false;
      return !(await d.store.isTrusted(userId, address, d.clock.now()));
    },

    async open(userId: string): Promise<{ challenge: string; expiresAt: Date }> {
      const challenge = d.secrets.newToken();
      const expiresAt = new Date(d.clock.now().getTime() + CHALLENGE_MS);
      await d.store.openChallenge(d.secrets.hashToken(challenge), userId, expiresAt);
      return { challenge, expiresAt };
    },

    async complete(challenge: string, code: string, address: string) {
      const tokenHash = d.secrets.hashToken(challenge);
      const pending = await d.store.challenge(tokenHash, d.clock.now());
      if (!pending) throw new AppError("unauthorized", "The sign-in has expired; sign in again", [{ code: CHALLENGE_EXPIRED }]);
      const tokens = await d.sessions.completeSecondFactor(pending.userId, () => verifyFactor(pending.userId, code));
      await d.store.closeChallenge(tokenHash);
      await d.store.trust(pending.userId, address, d.clock.now());
      return tokens;
    },

    async assertEnrolledIfRequired(actor: ActorContext): Promise<void> {
      if (!isEmployee(actor.role) || actor.sharedProjectId !== undefined) return;
      if (!(await d.store.organizationRequirement(actor.orgId))) return;
      if (await enabledRecord(actor.userId)) return;
      throw new AppError("forbidden", TWO_FACTOR_REQUIRED_MESSAGE, [{ code: TWO_FACTOR_SETUP_REQUIRED }]);
    },

    async organization(actor: ActorContext) {
      if (!can(actor, "update", "member")) throw new AppError("forbidden", "Only an admin may see this");
      const [required, enrolled] = await Promise.all([
        d.store.organizationRequirement(actor.orgId),
        d.store.enrolledMemberships(actor.orgId),
      ]);
      return { required, enrolledMembershipIds: enrolled };
    },

    async setRequirement(actor: ActorContext, required: boolean) {
      if (!can(actor, "update", "organization")) throw new AppError("forbidden", "Only an admin may require two-factor sign-in");
      await d.store.setOrganizationRequirement(actor.orgId, required);
      return { required };
    },

    async resetMember(actor: ActorContext, membershipId: string) {
      if (!can(actor, "update", "member")) throw new AppError("forbidden", "Only an admin may reset a second factor");
      const member = await d.store.memberOf(actor.orgId, membershipId);
      if (!member) throw new AppError("not-found", "Member not found");
      if (member.userId === actor.userId) throw new AppError("forbidden", "Ask another admin to reset your own second factor");
      await reset(member.userId);
      await d.unitOfWork.run((context) => d.audit.record(context, { membershipId, name: member.name }, actor));
    },

    async resetByEmail(principalId: string, email: string) {
      if (!(await d.platform.isPlatformAdmin(principalId))) throw new AppError("forbidden", "Only the platform administrator may do this");
      const user = await d.store.userByEmail(email);
      if (!user) throw new AppError("not-found", "No account uses this email");
      await reset(user.id);
    },
  };
}

export type TwoFactorUseCases = ReturnType<typeof createTwoFactorUseCases>;
