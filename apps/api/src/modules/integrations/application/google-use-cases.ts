import { AppError } from "#shared/domain/index.js";
import type { ActorContext } from "#shared/application/index.js";
import { ProviderError, publicIntegration, type Account, type GoogleAccountChoice } from "../domain/integration.js";
import type { IntegrationDependencies } from "./ports.js";
import { auditConnection, ensureConnectable, explained, reachableProject } from "./connection-rules.js";
import { nextMorning } from "./schedule.js";

const SIGN_IN_MS = 10 * 60_000;
const CHOICE_MS = 30 * 60_000;

export interface GoogleAuthorizationRecord {
  readonly id: string;
  readonly projectId: string;
  readonly userId: string;
  readonly integrationId: string | null;
  readonly encryptedRefreshToken: string | null;
}

export interface GoogleAuthorizations {
  open(data: { projectId: string; userId: string; integrationId: string | null }, now: Date, expiresAt: Date): Promise<GoogleAuthorizationRecord>;
  read(id: string, now: Date): Promise<GoogleAuthorizationRecord | null>;
  grant(id: string, encryptedRefreshToken: string, now: Date, expiresAt: Date): Promise<boolean>;
  close(id: string): Promise<void>;
}

export interface GoogleAccess {
  authorizeUrl(state: string): string;
  redeem(code: string): Promise<string>;
  accounts(refreshToken: string): Promise<GoogleAccountChoice[]>;
  account(accountId: string, loginCustomerId: string | null, refreshToken: string): Promise<Account>;
}

export interface GoogleDependencies extends Pick<IntegrationDependencies, "repository" | "cipher" | "projects" | "clock" | "unitOfWork" | "audit"> {
  google: GoogleAccess | null;
  authorizations: GoogleAuthorizations;
}

export interface GoogleSignInOutcome {
  readonly projectId: string | null;
  readonly authorization: string | null;
}

export function createGoogleUseCases(d: GoogleDependencies) {
  const configured = (): GoogleAccess => {
    if (!d.google) throw new AppError("validation", "Google integration: CONFIGURATION", [{ code: "CONFIGURATION" }]);
    return d.google;
  };

  const owned = async (actor: ActorContext, projectId: string, id: string) => {
    const found = await d.authorizations.read(id, d.clock.now());
    if (!found || found.projectId !== projectId || found.userId !== actor.userId || found.encryptedRefreshToken === null) {
      throw new AppError("not-found", "Google sign-in not found");
    }
    return { ...found, encryptedRefreshToken: found.encryptedRefreshToken };
  };

  const googleConnection = async (projectId: string, id: string) => {
    const found = await d.repository.read(projectId, id);
    if (!found || found.provider !== "GOOGLE") throw new AppError("not-found", "Integration not found");
    return found;
  };

  const data = (projectId: string, account: Account, encryptedToken: string, loginCustomerId: string | null) => ({
    ...account,
    projectId,
    provider: "GOOGLE",
    loginCustomerId,
    encryptedToken,
    queuedAt: d.clock.now(),
    nextDailyAt: nextMorning(d.clock.now()),
  });

  return {
    start: async (actor: ActorContext, projectId: string, integrationId: string | null): Promise<{ url: string }> => {
      const google = configured();
      await reachableProject(d.projects, actor, projectId);
      if (integrationId) await googleConnection(projectId, integrationId);
      const now = d.clock.now();
      const opened = await d.authorizations.open(
        { projectId, userId: actor.userId, integrationId },
        now,
        new Date(now.getTime() + SIGN_IN_MS),
      );
      return { url: google.authorizeUrl(opened.id) };
    },

    complete: async (input: { state: string; code: string | null }): Promise<GoogleSignInOutcome> => {
      const now = d.clock.now();
      const pending = await d.authorizations.read(input.state, now);
      if (!pending || pending.encryptedRefreshToken !== null) return { projectId: pending?.projectId ?? null, authorization: null };
      const failed = async () => {
        await d.authorizations.close(pending.id);
        return { projectId: pending.projectId, authorization: null };
      };
      if (!input.code || !d.google) return failed();
      try {
        const refreshToken = await d.google.redeem(input.code);
        const granted = await d.authorizations.grant(
          pending.id,
          d.cipher.encrypt(refreshToken, pending.projectId),
          now,
          new Date(now.getTime() + CHOICE_MS),
        );
        return granted ? { projectId: pending.projectId, authorization: pending.id } : failed();
      } catch (error) {
        if (error instanceof ProviderError) return failed();
        throw error;
      }
    },

    accounts: async (actor: ActorContext, projectId: string, authorizationId: string) => {
      const google = configured();
      await reachableProject(d.projects, actor, projectId);
      const authorization = await owned(actor, projectId, authorizationId);
      if (authorization.integrationId) return { renewing: true, accounts: [] };
      const refreshToken = d.cipher.decrypt(authorization.encryptedRefreshToken, projectId);
      const choices = await explained(() => google.accounts(refreshToken));
      const taken = new Set((await d.repository.list(projectId)).map((row) => row.accountId));
      return {
        renewing: false,
        accounts: choices
          .filter((choice) => !taken.has(choice.accountId))
          .map(({ accountId, name, currency, timezone, loginCustomerId }) => ({ accountId, name, currency, timezone, loginCustomerId })),
      };
    },

    connect: async (
      actor: ActorContext,
      projectId: string,
      input: { authorization: string; accountId?: string; loginCustomerId?: string | null },
    ) => {
      const google = configured();
      const project = await reachableProject(d.projects, actor, projectId);
      const authorization = await owned(actor, projectId, input.authorization);
      const refreshToken = d.cipher.decrypt(authorization.encryptedRefreshToken, projectId);
      const existing = authorization.integrationId ? await googleConnection(projectId, authorization.integrationId) : null;
      if (!existing && !input.accountId) throw new AppError("validation", "accountId is required");
      const accountId = existing?.accountId ?? input.accountId!;
      const loginCustomerId = existing ? existing.loginCustomerId : (input.loginCustomerId ?? null);

      const row = await explained(async () => {
        const account = await google.account(accountId, loginCustomerId, refreshToken);
        await ensureConnectable(d.repository, project, account, existing?.id);
        return d.unitOfWork.run(async (context) => {
          await d.repository.adoptCurrency(context, projectId, account.currency);
          const saved = existing
            ? await d.repository.replace(context, existing.id, data(projectId, account, authorization.encryptedRefreshToken, loginCustomerId), d.clock.now())
            : await d.repository.add(context, data(projectId, account, authorization.encryptedRefreshToken, loginCustomerId), d.clock.now());
          await auditConnection(
            d.audit,
            actor,
            project,
            existing ? "Renewed Google Ads sign-in" : "Connected Google Ads account",
          )(context);
          return saved;
        });
      });
      await d.authorizations.close(authorization.id);
      return { renewed: existing !== null, integration: publicIntegration(row)! };
    },
  };
}
