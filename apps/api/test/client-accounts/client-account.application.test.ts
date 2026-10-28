import { describe, expect, it } from "vitest";
import type { ActorContext, TransactionContext } from "../../src/shared/application/index.js";
import { createClientAccountUseCases } from "../../src/modules/client-accounts/application/client-account-use-cases.js";
import {
  LoginTakenError,
  type ClientAccountDependencies,
} from "../../src/modules/client-accounts/application/ports.js";
import type { ClientAccountRecord } from "../../src/modules/client-accounts/domain/client-account.js";

const admin: ActorContext = { userId: "u-admin", membershipId: "m-admin", orgId: "org", role: "ADMIN" };
const context = {} as TransactionContext;

function fixture(options: { taken?: readonly string[]; digits?: readonly string[] } = {}) {
  const taken = new Set(options.taken ?? []);
  const digits = [...(options.digits ?? ["4821"])];
  const accounts = new Map<string, ClientAccountRecord>();
  const users = new Map<string, { login: string; passwordHash: string; issuedPassword: string }>();
  const audited: string[] = [];
  let committed = 0;
  const dependencies: ClientAccountDependencies = {
    accounts: {
      findByClient: async (clientId) => accounts.get(clientId) ?? null,
      createUser: async (_tx, input) => {
        if (taken.has(input.login)) throw new LoginTakenError();
        users.set(input.id, input);
      },
      link: async (_tx, clientId, membershipId) => {
        const [userId, user] = [...users.entries()].at(-1)!;
        accounts.set(clientId, {
          userId, membershipId, login: user.login, issuedPassword: user.issuedPassword,
          createdAt: new Date("2026-10-28T10:00:00.000Z"),
        });
        return new Date("2026-10-28T10:00:00.000Z");
      },
      setPassword: async () => undefined,
      endSessions: async () => undefined,
    },
    clients: { findReachable: async (_actor, id) => (id === "c1" ? { id, name: "Клиника" } : null) },
    memberships: { enrol: async () => "m-client" },
    access: { grantClient: async () => undefined },
    credentials: { loginDigits: () => digits.shift() ?? "0000", password: () => "Secret234567" },
    passwords: { hash: async (plain) => `hash:${plain}` },
    cipher: { seal: (password, userId) => `sealed:${userId}:${password}`, open: (sealed) => sealed.split(":").at(-1)! },
    audit: { append: async (_tx, event) => { audited.push(event.summary); } },
    ids: { generate: () => "u-client" },
    unitOfWork: {
      run: async (work) => {
        const result = await work(context);
        committed += 1;
        return result;
      },
    },
  };
  return { useCases: createClientAccountUseCases(dependencies), users, audited, committed: () => committed };
}

describe("creating cabinet access", () => {
  it("tries other digits when a login is taken, in a fresh transaction", async () => {
    const { useCases, committed } = fixture({ taken: ["klinika-4821@balagan.pro"], digits: ["4821", "1357"] });

    const credentials = await useCases.create(admin, "c1");

    expect(credentials).toMatchObject({ login: "klinika-1357@balagan.pro", password: "Secret234567" });
    expect(committed()).toBe(1);
  });

  it("gives up after five logins in a row are taken", async () => {
    const { useCases } = fixture({
      taken: ["1", "2", "3", "4", "5"].map((digits) => `klinika-${digits}@balagan.pro`),
      digits: ["1", "2", "3", "4", "5"],
    });

    await expect(useCases.create(admin, "c1")).rejects.toThrow("Unable to generate a unique login");
  });

  it("keeps the hash and the sealed copy, never the password itself", async () => {
    const { useCases, users } = fixture();

    await useCases.create(admin, "c1");

    expect(users.get("u-client")).toEqual({
      id: "u-client", name: "Клиника", login: "klinika-4821@balagan.pro",
      passwordHash: "hash:Secret234567", issuedPassword: "sealed:u-client:Secret234567",
    });
  });

  it("names the client and not the password in the activity log", async () => {
    const { useCases, audited } = fixture();

    await useCases.create(admin, "c1");
    await useCases.reissue(admin, "c1");

    expect(audited).toEqual([
      "Created cabinet access for client “Клиника”",
      "Issued a new cabinet password for client “Клиника”",
    ]);
  });

  it("refuses a client the actor does not reach before judging the role", async () => {
    const { useCases } = fixture();
    const manager = { ...admin, role: "MANAGER" as const };

    await expect(useCases.read(manager, "c2")).rejects.toMatchObject({ category: "not-found" });
    await expect(useCases.read(manager, "c1")).rejects.toMatchObject({ category: "forbidden" });
  });
});
