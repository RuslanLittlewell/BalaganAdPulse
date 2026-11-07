import { describe, expect, it, vi } from "vitest";
import type { ActorContext } from "../../src/shared/application/index.js";
import { createSiteUseCases } from "../../src/modules/seo/application/site-use-cases.js";
import type { SignInRecord } from "../../src/modules/seo/application/ports.js";
import { SeoProviderError, type SeoSite } from "../../src/modules/seo/domain/seo-site.js";

const NOW = new Date("2026-11-07T06:00:00Z");
const admin: ActorContext = { userId: "u1", membershipId: "m1", orgId: "o1", role: "ADMIN" };
const other: ActorContext = { ...admin, userId: "u2", membershipId: "m2" };
const guest: ActorContext = { ...admin, userId: "u3", membershipId: "m3", role: "GUEST" };
const client: ActorContext = { ...admin, userId: "u4", membershipId: "m4", role: "CLIENT" };
const project = { id: "p1", clientId: "c1" };

const site = (over: Partial<SeoSite> = {}): SeoSite => ({
  id: "s1", projectId: "p1", siteUrl: "sc-domain:site.ru", origin: null, encryptedToken: "enc(old)", revision: "v1",
  status: "AUTH_REQUIRED", lastSuccessAt: null, lastError: "TOKEN", nextDailyAt: NOW, queuedAt: null, retryCount: 0,
  leaseOwner: null, leaseUntil: null, vitalsReadAt: null, checkStatus: "SUCCESS", lastCheckAt: null, checkError: null,
  nextCheckAt: NOW, checkQueuedAt: null, checkLeaseOwner: null, checkLeaseUntil: null, createdAt: NOW,
  ...over,
});

function fixture(options: { configured?: boolean; connected?: SeoSite[] } = {}) {
  const connected = [...(options.connected ?? [])];
  const signIns = new Map<string, SignInRecord & { expiresAt: Date }>();
  let sequence = 0;
  const sites = {
    list: vi.fn(async () => connected),
    read: vi.fn(async (projectId: string, id: string) => connected.find((row) => row.id === id && row.projectId === projectId) ?? null),
    add: vi.fn(async (_context: unknown, data: { projectId: string; siteUrl: string; encryptedToken: string }) => {
      const row = site({ ...data, id: `s${connected.length + 2}`, status: "QUEUED", lastError: null });
      connected.push(row);
      return row;
    }),
    renew: vi.fn(async (_context: unknown, id: string, encryptedToken: string) => {
      const index = connected.findIndex((row) => row.id === id);
      connected[index] = { ...connected[index]!, encryptedToken, status: "QUEUED", lastError: null };
      return connected[index]!;
    }),
    remove: vi.fn(async (_context: unknown, id: string) => {
      connected.splice(connected.findIndex((row) => row.id === id), 1);
    }),
    queueImport: vi.fn(async () => {}),
    queueCheck: vi.fn(async () => {}),
  };
  const console = {
    consentUrl: vi.fn((state: string) => `https://accounts.google.test/?state=${state}`),
    accessToken: vi.fn(async (refresh: string) => `access(${refresh})`),
    sites: vi.fn(async () => [
      { siteUrl: "sc-domain:site.ru", permissionLevel: "siteOwner" },
      { siteUrl: "https://shop.ru/", permissionLevel: "siteFullUser" },
    ]),
    totals: vi.fn(),
    top: vi.fn(),
    sitemaps: vi.fn(),
  };
  const audit = { append: vi.fn(async () => {}) };
  const service = createSiteUseCases({
    sites,
    signIns: {
      open: async (data, _now, expiresAt) => {
        const record = { id: `auth-${++sequence}`, encryptedRefreshToken: null, ...data, expiresAt };
        signIns.set(record.id, record);
        return record;
      },
      read: async (id, now) => {
        const found = signIns.get(id);
        return found && found.expiresAt > now ? found : null;
      },
      close: async (id) => { signIns.delete(id); },
    },
    cipher: { encrypt: (token) => `enc(${token})`, decrypt: (value) => value.replace(/^enc\((.*)\)$/, "$1") },
    console: options.configured === false ? null : console,
    projects: { findReachable: vi.fn(async (actor: ActorContext, id: string) => (id === "p1" && actor.orgId === "o1" ? project : null)) },
    clock: { now: () => NOW },
    unitOfWork: { run: async (work: (context: unknown) => unknown) => work({}) } as never,
    audit: audit as never,
  });
  const signedIn = async (actor = admin, siteId: string | null = null) => {
    const { url } = await service.start(actor, "p1", siteId);
    const state = new URL(url).searchParams.get("state")!;
    const pending = signIns.get(state)!;
    signIns.set(state, { ...pending, encryptedRefreshToken: "enc(refresh)" });
    return state;
  };
  return { service, sites, console, audit, signIns, signedIn, connected };
}

describe("starting a Search Console sign-in", () => {
  it("opens a sign-in for Search Console that belongs to this member and project", async () => {
    const d = fixture();
    const { url } = await d.service.start(admin, "p1", null);
    const state = new URL(url).searchParams.get("state")!;
    expect(d.signIns.get(state)).toMatchObject({ projectId: "p1", userId: "u1", integrationId: null, purpose: "SEARCH_CONSOLE" });
  });

  it("says Google is not configured", async () => {
    const d = fixture({ configured: false });
    await expect(d.service.start(admin, "p1", null)).rejects.toMatchObject({ category: "validation", details: [{ code: "CONFIGURATION" }] });
  });

  it("answers 404 for an unreachable project and 403 to guests and clients", async () => {
    const d = fixture();
    await expect(d.service.start(admin, "elsewhere", null)).rejects.toMatchObject({ category: "not-found" });
    await expect(d.service.start(guest, "p1", null)).rejects.toMatchObject({ category: "forbidden" });
    await expect(d.service.start(client, "p1", null)).rejects.toMatchObject({ category: "forbidden" });
  });

  it("will not renew a site the project does not hold", async () => {
    const d = fixture();
    await expect(d.service.start(admin, "p1", "missing")).rejects.toMatchObject({ category: "not-found" });
  });
});

describe("choosing a site", () => {
  it("lists the sites the sign-in reaches without the ones the project holds", async () => {
    const d = fixture({ connected: [site()] });
    const state = await d.signedIn();

    const choices = await d.service.choices(admin, "p1", state);

    expect(choices).toEqual({ renewing: false, sites: [{ siteUrl: "https://shop.ru/", label: "shop.ru", permissionLevel: "siteFullUser" }] });
    expect(d.console.accessToken).toHaveBeenCalledWith("refresh");
  });

  it("belongs to the member who signed in, on their project", async () => {
    const d = fixture();
    const state = await d.signedIn();
    await expect(d.service.choices(other, "p1", state)).rejects.toMatchObject({ category: "not-found" });
  });

  it("is not available before Google answered", async () => {
    const d = fixture();
    const { url } = await d.service.start(admin, "p1", null);
    await expect(d.service.choices(admin, "p1", new URL(url).searchParams.get("state")!)).rejects.toMatchObject({ category: "not-found" });
  });

  it("does not take a Google Ads sign-in", async () => {
    const d = fixture();
    d.signIns.set("ads", {
      id: "ads", projectId: "p1", userId: "u1", integrationId: null, purpose: "ADS",
      encryptedRefreshToken: "enc(refresh)", expiresAt: new Date(NOW.getTime() + 60_000),
    });
    await expect(d.service.choices(admin, "p1", "ads")).rejects.toMatchObject({ category: "not-found" });
  });

  it("explains a Google failure without leaking it", async () => {
    const d = fixture();
    d.console.sites.mockRejectedValue(new SeoProviderError("PROVIDER", 0, "http 503"));
    const state = await d.signedIn();
    await expect(d.service.choices(admin, "p1", state)).rejects.toMatchObject({ category: "validation", details: [{ code: "PROVIDER" }] });
  });
});

describe("connecting the chosen site", () => {
  it("saves the site with its own credential, audits it and spends the sign-in", async () => {
    const d = fixture();
    const state = await d.signedIn();

    const { renewed, site: saved } = await d.service.connect(admin, "p1", { authorization: state, siteUrl: "sc-domain:site.ru" });

    expect(renewed).toBe(false);
    expect(saved).toMatchObject({ siteUrl: "sc-domain:site.ru", label: "site.ru", status: "QUEUED" });
    expect(JSON.stringify(saved)).not.toContain("refresh");
    expect(d.sites.add).toHaveBeenCalledWith({}, { projectId: "p1", siteUrl: "sc-domain:site.ru", encryptedToken: "enc(refresh)" }, NOW);
    expect(d.audit.append).toHaveBeenCalledWith({}, expect.objectContaining({ summary: "Connected Search Console site site.ru" }), admin);
    expect(d.signIns.has(state)).toBe(false);
  });

  it("refuses a site the sign-in does not reach", async () => {
    const d = fixture();
    const state = await d.signedIn();
    await expect(d.service.connect(admin, "p1", { authorization: state, siteUrl: "https://other.ru/" }))
      .rejects.toMatchObject({ category: "validation", details: [{ code: "SITE" }] });
    expect(d.sites.add).not.toHaveBeenCalled();
  });

  it("refuses a site the project already holds with 409", async () => {
    const d = fixture({ connected: [site({ status: "SUCCESS" })] });
    const state = await d.signedIn();
    await expect(d.service.connect(admin, "p1", { authorization: state, siteUrl: "sc-domain:site.ru" }))
      .rejects.toMatchObject({ category: "conflict" });
    expect(d.connected).toHaveLength(1);
  });

  it("needs a site when it renews nothing", async () => {
    const d = fixture();
    const state = await d.signedIn();
    await expect(d.service.connect(admin, "p1", { authorization: state })).rejects.toMatchObject({ category: "validation" });
  });

  it("renews the site the sign-in was started for, in place", async () => {
    const d = fixture({ connected: [site()] });
    const state = await d.signedIn(admin, "s1");

    expect(await d.service.choices(admin, "p1", state)).toEqual({ renewing: true, sites: [] });
    const { renewed, site: saved } = await d.service.connect(admin, "p1", { authorization: state });

    expect(renewed).toBe(true);
    expect(saved).toMatchObject({ id: "s1", status: "QUEUED" });
    expect(d.sites.renew).toHaveBeenCalledWith({}, "s1", "enc(refresh)", NOW);
    expect(d.sites.add).not.toHaveBeenCalled();
  });

  it("refuses to renew a site with a sign-in that no longer reaches it", async () => {
    const d = fixture({ connected: [site({ siteUrl: "https://gone.ru/" })] });
    const state = await d.signedIn(admin, "s1");
    await expect(d.service.connect(admin, "p1", { authorization: state })).rejects.toMatchObject({ details: [{ code: "SITE" }] });
    expect(d.sites.renew).not.toHaveBeenCalled();
  });
});

describe("managing a connected site", () => {
  it("lists sites to anyone who reads the project, without credentials", async () => {
    const d = fixture({ connected: [site()] });
    const listed = await d.service.list(guest, "p1");
    expect(listed).toEqual([expect.objectContaining({ id: "s1", label: "site.ru", status: "AUTH_REQUIRED" })]);
    expect(JSON.stringify(listed)).not.toContain("enc(");
  });

  it("queues an import and a check for members who manage integrations only", async () => {
    const d = fixture({ connected: [site()] });
    await d.service.sync(admin, "p1", "s1");
    await d.service.check(admin, "p1", "s1");
    expect(d.sites.queueImport).toHaveBeenCalledWith("s1", NOW);
    expect(d.sites.queueCheck).toHaveBeenCalledWith("s1", NOW);
    await expect(d.service.check(guest, "p1", "s1")).rejects.toMatchObject({ category: "forbidden" });
    await expect(d.service.sync(client, "p1", "s1")).rejects.toMatchObject({ category: "forbidden" });
    await expect(d.service.sync(admin, "p1", "missing")).rejects.toMatchObject({ category: "not-found" });
  });

  it("disconnects a site and audits it", async () => {
    const d = fixture({ connected: [site()] });
    await d.service.disconnect(admin, "p1", "s1");
    expect(d.connected).toHaveLength(0);
    expect(d.audit.append).toHaveBeenCalledWith({}, expect.objectContaining({ summary: "Disconnected Search Console site site.ru" }), admin);
  });
});
