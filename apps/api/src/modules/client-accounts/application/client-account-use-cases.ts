import { can } from "@adpulse/access-policy";
import { AppError } from "#shared/domain/index.js";
import type { ActorContext } from "#shared/application/index.js";
import {
  loginOf,
  loginPrefix,
  type ClientAccountRecord,
  type ClientCredentials,
} from "../domain/client-account.js";
import { LoginTakenError, type ClientAccountDependencies } from "./ports.js";

const MAX_LOGIN_ATTEMPTS = 5;

export const ACCESS_EXISTS = "This client already has cabinet access";
export const NO_ACCESS = "This client has no cabinet access";

export function createClientAccountUseCases(dependencies: ClientAccountDependencies) {
  const reach = async (actor: ActorContext, clientId: string, action: "read" | "create" | "update") => {
    const client = await dependencies.clients.findReachable(actor, clientId);
    if (!client) throw new AppError("not-found", "Client not found");
    if (!can(actor, action, "client-account")) {
      throw new AppError("forbidden", `Your role may not ${action} a client's cabinet access`);
    }
    return client;
  };

  const credentialsOf = (account: ClientAccountRecord, password: string | null): ClientCredentials => ({
    login: account.login, password, createdAt: account.createdAt,
  });

  const issue = async (userId: string) => {
    const password = dependencies.credentials.password();
    return {
      password,
      stored: {
        passwordHash: await dependencies.passwords.hash(password),
        issuedPassword: dependencies.cipher.seal(password, userId),
      },
    };
  };

  return {
    read: async (actor: ActorContext, clientId: string): Promise<ClientCredentials | null> => {
      await reach(actor, clientId, "read");
      const account = await dependencies.accounts.findByClient(clientId);
      if (!account) return null;
      return credentialsOf(
        account,
        account.issuedPassword ? dependencies.cipher.open(account.issuedPassword, account.userId) : null,
      );
    },

    create: async (actor: ActorContext, clientId: string): Promise<ClientCredentials> => {
      const client = await reach(actor, clientId, "create");
      if (await dependencies.accounts.findByClient(clientId)) throw new AppError("conflict", ACCESS_EXISTS);
      const userId = dependencies.ids.generate();
      const { password, stored } = await issue(userId);
      const prefix = loginPrefix(client.name);
      for (let attempt = 0; attempt < MAX_LOGIN_ATTEMPTS; attempt += 1) {
        const login = loginOf(prefix, dependencies.credentials.loginDigits());
        try {
          const createdAt = await dependencies.unitOfWork.run(async (context) => {
            await dependencies.accounts.createUser(context, { id: userId, name: client.name, login, ...stored });
            const membershipId = await dependencies.memberships.enrol(context, {
              userId, orgId: actor.orgId, role: "CLIENT_ADMIN",
            });
            await dependencies.access.grantClient(context, membershipId, clientId);
            const linkedAt = await dependencies.accounts.link(context, clientId, membershipId);
            await dependencies.audit.append(context, {
              action: "CREATE", entityType: "client", entityId: clientId, clientId,
              summary: `Created cabinet access for client “${client.name}”`,
            }, actor);
            return linkedAt;
          });
          return { login, password, createdAt };
        } catch (error) {
          if (!(error instanceof LoginTakenError)) throw error;
        }
      }
      throw new Error("Unable to generate a unique login");
    },

    reissue: async (actor: ActorContext, clientId: string): Promise<ClientCredentials> => {
      const client = await reach(actor, clientId, "update");
      const account = await dependencies.accounts.findByClient(clientId);
      if (!account) throw new AppError("not-found", NO_ACCESS);
      const { password, stored } = await issue(account.userId);
      await dependencies.unitOfWork.run(async (context) => {
        await dependencies.accounts.setPassword(context, account.userId, stored);
        await dependencies.accounts.endSessions(context, account.userId);
        await dependencies.audit.append(context, {
          action: "UPDATE", entityType: "client", entityId: clientId, clientId,
          summary: `Issued a new cabinet password for client “${client.name}”`,
        }, actor);
      });
      return credentialsOf(account, password);
    },
  };
}

export type ClientAccountUseCases = ReturnType<typeof createClientAccountUseCases>;
