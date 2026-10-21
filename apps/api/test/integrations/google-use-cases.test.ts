import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ActorContext } from "../../src/shared/application/index.js";
import {
  createGoogleUseCases,
  type GoogleAuthorizationRecord,
} from "../../src/modules/integrations/application/google-use-cases.js";
import { ProviderError, type Integration } from "../../src/modules/integrations/domain/integration.js";

const NOW = new Date("2026-09-08T06:00:00Z");
const admin: ActorContext = { userId: "u1", membershipId: "m1", orgId: "o1", role: "ADMIN" };
const other: ActorContext = { ...admin, userId: "u2", membershipId: "m2" };
const client: ActorContext = { ...admin, userId: "u3", membershipId: "m3", role: "CLIENT" };
const project = { id: "p1", clientId: "c1", budgetCurrency: null as string | null };

const integration = (over: Partial<Integration> = {}): Integration => ({
  id: "i1", projectId: "p1", provider: "GOOGLE", loginCustomerId: "111", accountId: "222", currency: "USD", timezone: "UTC",
  leadsEnabled: false, encryptedToken: "enc(old)", revision: "v1", status: "AUTH_REQUIRED", lastSuccessAt: null, lastError: "TOKEN",
  nextDailyAt: NOW, queuedAt: null, retryCount: 0, leaseOwner: null, leaseUntil: null, leadsStatus: "WAITING",
  leadsCoveredUntil: null, leadsLastSuccessAt: null, leadsLastError: null, nextLeadsAt: NOW, leadsQueuedAt: null,
  nextSweepAt: null, leadsLeaseOwner: null, leadsLeaseUntil: null,
  ...over,
});

function fixture(options: { configured?: boolean; connected?: Integration[]; figures?: boolean; accountCurrency?: string } = {}) {
  const connected = [...(options.connected ?? [])];
  const authorizations = new Map<string, GoogleAuthorizationRecord & { expiresAt: Date }>();
  let sequence = 0;
  const repository = {
    list: vi.fn(async () => connected),
    read: vi.fn(async (_projectId: string, id: string) => connected.find((row) => row.id === id) ?? null),
    add: vi.fn(async (_c: unknown, data: Record<string, unknown>) => {
      const row = integration({ ...data, id: "new", status: "QUEUED", lastError: null } as Partial<Integration>);
      connected.push(row);
      return row;
    }),
    replace: vi.fn(async (_c: unknown, id: string, data: Record<string, unknown>) => {
      const row = integration({ ...data, id, status: "QUEUED", lastError: null } as Partial<Integration>);
      connected.splice(connected.findIndex((candidate) => candidate.id === id), 1, row);
      return row;
    }),
    holdsFigures: vi.fn(async () => options.figures ?? false),
    adoptCurrency: vi.fn(async () => {}),
  };
  const google = {
    authorizeUrl: vi.fn((state: string) => `https://accounts.google.test/?state=${state}`),
    redeem: vi.fn(async (code: string) => `refresh(${code})`),
    accounts: vi.fn(async () => [
      { accountId: "222", name: "Shop", currency: "USD", timezone: "UTC", loginCustomerId: "111" },
      { accountId: "333", name: "Blog", currency: "USD", timezone: "UTC", loginCustomerId: null },
    ]),
    account: vi.fn(async (accountId: string) => ({ accountId, currency: options.accountCurrency ?? "USD", timezone: "UTC" })),
  };
  const audit = { append: vi.fn(async () => {}) };
  const service = createGoogleUseCases({
    repository: repository as never,
    cipher: { encrypt: (token: string) => `enc(${token})`, decrypt: (value: string) => value.replace(/^enc\((.*)\)$/, "$1") },
    projects: { findReachable: vi.fn(async (actor: ActorContext, id: string) => (id === "p1" && actor.orgId === "o1" ? project : null)) },
    clock: { now: () => NOW },
    unitOfWork: { run: async (work: (context: unknown) => unknown) => work({}) } as never,
    audit: audit as never,
    google: options.configured === false ? null : google,
    authorizations: {
      open: async (data, _now, expiresAt) => {
        const record = { id: `auth-${++sequence}`, encryptedRefreshToken: null, ...data, expiresAt };
        authorizations.set(record.id, record);
        return record;
      },
      read: async (id, now) => {
        const found = authorizations.get(id);
        return found && found.expiresAt > now ? found : null;
      },
      grant: async (id, token) => {
        const found = authorizations.get(id);
        if (!found || found.encryptedRefreshToken !== null) return false;
        authorizations.set(id, { ...found, encryptedRefreshToken: token });
        return true;
      },
      close: async (id) => { authorizations.delete(id); },
    },
  });
  const signedIn = async (actor = admin, integrationId: string | null = null) => {
    const { url } = await service.start(actor, "p1", integrationId);
    const state = new URL(url).searchParams.get("state")!;
    await service.complete({ state, code: "the-code" });
    return state;
  };
  return { service, repository, google, audit, authorizations, signedIn, connected };
}

describe("starting a sign-in", () => {
  it("hands back Google's address carrying a state that belongs to this member and project", async () => {
    const d = fixture();
    const { url } = await d.service.start(admin, "p1", null);
    const state = new URL(url).searchParams.get("state")!;
    expect(d.authorizations.get(state)).toMatchObject({ projectId: "p1", userId: "u1", integrationId: null, encryptedRefreshToken: null });
  });

  it("says Google is not configured rather than failing obscurely", async () => {
    const d = fixture({ configured: false });
    await expect(d.service.start(admin, "p1", null)).rejects.toMatchObject({ category: "validation", details: [{ code: "CONFIGURATION" }] });
  });

  it("answers 404 for a project the member cannot reach and 403 to a customer", async () => {
    const d = fixture();
    await expect(d.service.start(admin, "elsewhere", null)).rejects.toMatchObject({ category: "not-found" });
    await expect(d.service.start(client, "p1", null)).rejects.toMatchObject({ category: "forbidden" });
  });

  it("will not renew a connection that is not a Google one or is not the project's", async () => {
    const d = fixture({ connected: [integration({ id: "meta", provider: "META" })] });
    await expect(d.service.start(admin, "p1", "meta")).rejects.toMatchObject({ category: "not-found" });
    await expect(d.service.start(admin, "p1", "missing")).rejects.toMatchObject({ category: "not-found" });
  });
});

describe("Google's answer", () => {
  let d: ReturnType<typeof fixture>;
  beforeEach(() => { d = fixture(); });

  it("keeps the refresh token encrypted against the project and offers the sign-in for choosing an account", async () => {
    const { url } = await d.service.start(admin, "p1", null);
    const state = new URL(url).searchParams.get("state")!;

    const outcome = await d.service.complete({ state, code: "abc" });

    expect(outcome).toEqual({ projectId: "p1", authorization: state });
    expect(d.authorizations.get(state)?.encryptedRefreshToken).toBe("enc(refresh(abc))");
  });

  it("completes a sign-in once", async () => {
    const { url } = await d.service.start(admin, "p1", null);
    const state = new URL(url).searchParams.get("state")!;
    await d.service.complete({ state, code: "abc" });

    expect(await d.service.complete({ state, code: "abc" })).toEqual({ projectId: "p1", authorization: null });
    expect(d.google.redeem).toHaveBeenCalledOnce();
  });

  it("knows nothing of a state it never issued", async () => {
    expect(await d.service.complete({ state: "forged", code: "abc" })).toEqual({ projectId: null, authorization: null });
    expect(d.google.redeem).not.toHaveBeenCalled();
  });

  it("closes the sign-in when the member declined at Google", async () => {
    const { url } = await d.service.start(admin, "p1", null);
    const state = new URL(url).searchParams.get("state")!;

    expect(await d.service.complete({ state, code: null })).toEqual({ projectId: "p1", authorization: null });
    expect(d.authorizations.has(state)).toBe(false);
  });

  it("closes the sign-in when Google refuses the code", async () => {
    d.google.redeem.mockRejectedValue(new ProviderError("TOKEN", 0, "", "Google"));
    const { url } = await d.service.start(admin, "p1", null);
    const state = new URL(url).searchParams.get("state")!;

    expect(await d.service.complete({ state, code: "stale" })).toEqual({ projectId: "p1", authorization: null });
    expect(d.authorizations.has(state)).toBe(false);
  });
});

describe("choosing an account", () => {
  it("lists the accounts the sign-in reaches without the ones the project already holds", async () => {
    const d = fixture({ connected: [integration({ id: "held", accountId: "222" })] });
    const state = await d.signedIn();

    const { accounts, renewing } = await d.service.accounts(admin, "p1", state);

    expect(renewing).toBe(false);
    expect(accounts.map((account) => account.accountId)).toEqual(["333"]);
    expect(d.google.accounts).toHaveBeenCalledWith("refresh(the-code)");
  });

  it("is for the member who signed in, on the project they signed in for", async () => {
    const d = fixture();
    const state = await d.signedIn();
    await expect(d.service.accounts(other, "p1", state)).rejects.toMatchObject({ category: "not-found" });
    await expect(d.service.accounts(admin, "p2", state)).rejects.toMatchObject({ category: "not-found" });
  });

  it("is not available before Google has answered", async () => {
    const d = fixture();
    const { url } = await d.service.start(admin, "p1", null);
    await expect(d.service.accounts(admin, "p1", new URL(url).searchParams.get("state")!)).rejects.toMatchObject({ category: "not-found" });
  });

  it("has no choice to offer when the sign-in renews a connection", async () => {
    const d = fixture({ connected: [integration()] });
    const state = await d.signedIn(admin, "i1");
    expect(await d.service.accounts(admin, "p1", state)).toEqual({ renewing: true, accounts: [] });
  });
});

describe("connecting the chosen account", () => {
  it("saves a Google connection with its own credential, takes the account's currency and queues the first import", async () => {
    const d = fixture();
    const state = await d.signedIn();

    const { renewed, integration: saved } = await d.service.connect(admin, "p1", { authorization: state, accountId: "222", loginCustomerId: "111" });

    expect(renewed).toBe(false);
    expect(saved).toMatchObject({ provider: "GOOGLE", accountId: "222", status: "QUEUED" });
    expect(JSON.stringify(saved)).not.toContain("refresh");
    expect(d.repository.add).toHaveBeenCalledWith({}, expect.objectContaining({
      provider: "GOOGLE", accountId: "222", loginCustomerId: "111", encryptedToken: "enc(refresh(the-code))", queuedAt: NOW,
    }), NOW);
    expect(d.repository.adoptCurrency).toHaveBeenCalledWith({}, "p1", "USD");
    expect(d.audit.append).toHaveBeenCalledWith({}, expect.objectContaining({ summary: "Connected Google Ads account" }), admin);
    expect(d.authorizations.has(state)).toBe(false);
  });

  it("is spent with the connection: the same sign-in connects nothing twice", async () => {
    const d = fixture();
    const state = await d.signedIn();
    await d.service.connect(admin, "p1", { authorization: state, accountId: "222" });
    await expect(d.service.connect(admin, "p1", { authorization: state, accountId: "333" })).rejects.toMatchObject({ category: "not-found" });
  });

  it("asks for an account when nothing is being renewed", async () => {
    const d = fixture();
    const state = await d.signedIn();
    await expect(d.service.connect(admin, "p1", { authorization: state })).rejects.toMatchObject({ category: "validation" });
    expect(d.repository.add).not.toHaveBeenCalled();
  });

  it("refuses an account the project already holds", async () => {
    const d = fixture({ connected: [integration({ id: "held", accountId: "222" })] });
    const state = await d.signedIn();
    await expect(d.service.connect(admin, "p1", { authorization: state, accountId: "222" })).rejects.toMatchObject({ category: "conflict" });
  });

  it("refuses an account billed in another currency than the project's other connections", async () => {
    const d = fixture({ connected: [integration({ id: "held", accountId: "999", currency: "EUR" })] });
    const state = await d.signedIn();
    await expect(d.service.connect(admin, "p1", { authorization: state, accountId: "222" }))
      .rejects.toMatchObject({ category: "validation", details: [{ code: "CURRENCY" }] });
  });

  it("refuses an account billed in another currency than the figures the project holds", async () => {
    const d = fixture({ figures: true });
    const state = await d.signedIn();
    await expect(d.service.connect(admin, "p1", { authorization: state, accountId: "222" }))
      .rejects.toMatchObject({ details: [{ code: "CURRENCY" }] });
    expect(d.repository.add).not.toHaveBeenCalled();
  });

  it("keeps the sign-in open when Google refuses the account, so another can be chosen", async () => {
    const d = fixture();
    const state = await d.signedIn();
    d.google.account.mockRejectedValueOnce(new ProviderError("ACCESS", 0, "", "Google"));

    await expect(d.service.connect(admin, "p1", { authorization: state, accountId: "222" })).rejects.toMatchObject({ details: [{ code: "ACCESS" }] });

    expect(d.authorizations.has(state)).toBe(true);
  });

  it("is for the member who signed in", async () => {
    const d = fixture();
    const state = await d.signedIn();
    await expect(d.service.connect(other, "p1", { authorization: state, accountId: "222" })).rejects.toMatchObject({ category: "not-found" });
  });
});

describe("signing in again on a connection whose sign-in was revoked", () => {
  it("replaces the credential on the same connection, keeps its account and resumes importing", async () => {
    const d = fixture({ connected: [integration()] });
    const state = await d.signedIn(admin, "i1");

    const { renewed, integration: saved } = await d.service.connect(admin, "p1", { authorization: state });

    expect(renewed).toBe(true);
    expect(saved).toMatchObject({ id: "i1", accountId: "222", status: "QUEUED" });
    expect(d.connected).toHaveLength(1);
    expect(d.google.account).toHaveBeenCalledWith("222", "111", "refresh(the-code)");
    expect(d.repository.replace).toHaveBeenCalledWith({}, "i1", expect.objectContaining({
      accountId: "222", loginCustomerId: "111", encryptedToken: "enc(refresh(the-code))",
    }), NOW);
    expect(d.repository.add).not.toHaveBeenCalled();
    expect(d.audit.append).toHaveBeenCalledWith({}, expect.objectContaining({ summary: "Renewed Google Ads sign-in" }), admin);
  });

  it("ignores an account named alongside, since the connection keeps its own", async () => {
    const d = fixture({ connected: [integration()] });
    const state = await d.signedIn(admin, "i1");
    await d.service.connect(admin, "p1", { authorization: state, accountId: "333" });
    expect(d.google.account).toHaveBeenCalledWith("222", "111", expect.any(String));
  });

  it("does not renew when the new sign-in cannot reach the account", async () => {
    const d = fixture({ connected: [integration()] });
    const state = await d.signedIn(admin, "i1");
    d.google.account.mockRejectedValueOnce(new ProviderError("ACCESS", 0, "", "Google"));

    await expect(d.service.connect(admin, "p1", { authorization: state })).rejects.toMatchObject({ details: [{ code: "ACCESS" }] });

    expect(d.repository.replace).not.toHaveBeenCalled();
  });
});
