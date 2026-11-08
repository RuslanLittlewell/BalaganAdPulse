import { describe, expect, it, vi } from "vitest";
import type { ActorContext } from "../../src/shared/application/index.js";
import { createTrafficUseCases } from "../../src/modules/seo/application/traffic-use-cases.js";
import type { SignInRecord } from "../../src/modules/seo/application/ports.js";
import type { SeoSite } from "../../src/modules/seo/domain/seo-site.js";

const NOW = new Date("2026-11-07T06:00:00Z");
const admin: ActorContext = { userId: "u1", membershipId: "m1", orgId: "o1", role: "ADMIN" };
const other: ActorContext = { ...admin, userId: "u2", membershipId: "m2" };
const client: ActorContext = { ...admin, userId: "u4", membershipId: "m4", role: "CLIENT" };
const project = { id: "p1", clientId: "c1" };

const site = (over: Partial<SeoSite> = {}): SeoSite => ({
  id: "s1", projectId: "p1", siteUrl: "sc-domain:site.ru", origin: null, encryptedToken: "enc(old)", revision: "v1",
  status: "SUCCESS", lastSuccessAt: NOW, lastError: null, nextDailyAt: NOW, queuedAt: null, retryCount: 0,
  leaseOwner: null, leaseUntil: null, vitalsReadAt: null, checkStatus: "SUCCESS", lastCheckAt: null, checkError: null,
  nextCheckAt: NOW, checkQueuedAt: null, checkLeaseOwner: null, checkLeaseUntil: null,
  analyticsPropertyId: null, analyticsName: null, trafficStatus: "QUEUED", trafficSuccessAt: null, trafficError: null,
  nextTrafficAt: null, trafficQueuedAt: null, trafficRetryCount: 0, trafficLeaseOwner: null, trafficLeaseUntil: null,
  createdAt: NOW,
  ...over,
});

function fixture(options: { configured?: boolean; reaches?: string } = {}) {
  const row = site();
  const signIns = new Map<string, SignInRecord & { expiresAt: Date }>();
  let sequence = 0;
  const sites = {
    list: vi.fn(), add: vi.fn(), renew: vi.fn(), remove: vi.fn(), queueImport: vi.fn(), queueCheck: vi.fn(), queueTraffic: vi.fn(),
    read: vi.fn(async (projectId: string, id: string) => (id === "s1" && projectId === "p1" ? row : null)),
    linkAnalytics: vi.fn(async (_context: unknown, _id: string, link: { propertyId: string; name: string }) =>
      site({ analyticsPropertyId: link.propertyId, analyticsName: link.name })),
    unlinkAnalytics: vi.fn(async () => {}),
  };
  const analytics = {
    consentUrl: vi.fn((state: string) => `https://accounts.google.test/?state=${state}`),
    accessToken: vi.fn(async (refresh: string) => `access(${refresh})`),
    properties: vi.fn(async () => [{ propertyId: "111", name: "Acme / site.ru" }, { propertyId: "222", name: "Acme / shop.ru" }]),
    sessions: vi.fn(),
  };
  const console = { sites: vi.fn(async () => [{ siteUrl: options.reaches ?? "sc-domain:site.ru", permissionLevel: "siteOwner" }]) };
  const audit = { append: vi.fn(async () => {}) };
  const service = createTrafficUseCases({
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
    console: console as never,
    analytics: options.configured === false ? null : analytics,
    projects: { findReachable: vi.fn(async (actor: ActorContext, id: string) => (id === "p1" && actor.orgId === "o1" ? project : null)) },
    clock: { now: () => NOW },
    unitOfWork: { run: async (work: (context: unknown) => unknown) => work({}) } as never,
    audit: audit as never,
  });
  const signedIn = async (actor = admin) => {
    const { url } = await service.start(actor, "p1", "s1");
    const state = new URL(url).searchParams.get("state")!;
    signIns.set(state, { ...signIns.get(state)!, encryptedRefreshToken: "enc(fresh)" });
    return state;
  };
  return { service, sites, analytics, audit, signIns, signedIn };
}

describe("linking an Analytics property", () => {
  it("opens an Analytics sign-in bound to the site and this member", async () => {
    const d = fixture();
    const { url } = await d.service.start(admin, "p1", "s1");
    const state = new URL(url).searchParams.get("state")!;
    expect(d.signIns.get(state)).toMatchObject({ projectId: "p1", userId: "u1", integrationId: "s1", purpose: "SITE_ANALYTICS" });
  });

  it("says Google is not configured", async () => {
    await expect(fixture({ configured: false }).service.start(admin, "p1", "s1")).rejects.toMatchObject({ details: [{ code: "CONFIGURATION" }] });
  });

  it("refuses clients, unknown sites and unreachable projects", async () => {
    const d = fixture();
    await expect(d.service.start(client, "p1", "s1")).rejects.toMatchObject({ category: "forbidden" });
    await expect(d.service.start(admin, "p1", "missing")).rejects.toMatchObject({ category: "not-found" });
    await expect(d.service.start(admin, "elsewhere", "s1")).rejects.toMatchObject({ category: "not-found" });
  });

  it("lists the properties a finished sign-in reaches", async () => {
    const d = fixture();
    const state = await d.signedIn();
    const listed = await d.service.properties(admin, "p1", state);
    expect(listed.siteId).toBe("s1");
    expect(listed.properties).toHaveLength(2);
    expect(d.analytics.accessToken).toHaveBeenCalledWith("fresh");
  });

  it("hides another member's sign-in and an unfinished one", async () => {
    const d = fixture();
    const state = await d.signedIn();
    await expect(d.service.properties(other, "p1", state)).rejects.toMatchObject({ category: "not-found" });
    const { url } = await d.service.start(admin, "p1", "s1");
    await expect(d.service.properties(admin, "p1", new URL(url).searchParams.get("state")!)).rejects.toMatchObject({ category: "not-found" });
  });

  it("links the chosen property, keeps the new credential and closes the sign-in", async () => {
    const d = fixture();
    const state = await d.signedIn();
    const linked = await d.service.link(admin, "p1", "s1", { authorization: state, propertyId: "111" });
    expect(d.sites.linkAnalytics).toHaveBeenCalledWith(expect.anything(), "s1", { encryptedToken: "enc(fresh)", propertyId: "111", name: "Acme / site.ru" }, NOW);
    expect(linked.analytics).toMatchObject({ propertyId: "111", name: "Acme / site.ru" });
    expect(JSON.stringify(linked)).not.toContain("fresh");
    expect(d.signIns.has(state)).toBe(false);
    expect(d.audit.append).toHaveBeenCalled();
  });

  it("refuses a property the sign-in does not reach", async () => {
    const d = fixture();
    const state = await d.signedIn();
    await expect(d.service.link(admin, "p1", "s1", { authorization: state, propertyId: "999" })).rejects.toMatchObject({ details: [{ code: "PROPERTY" }] });
    expect(d.sites.linkAnalytics).not.toHaveBeenCalled();
  });

  it("refuses a sign-in that reaches another Search Console property", async () => {
    const d = fixture({ reaches: "https://shop.ru/" });
    const state = await d.signedIn();
    await expect(d.service.link(admin, "p1", "s1", { authorization: state, propertyId: "111" })).rejects.toMatchObject({ details: [{ code: "SITE" }] });
  });

  it("refuses a sign-in used once already", async () => {
    const d = fixture();
    const state = await d.signedIn();
    await d.service.link(admin, "p1", "s1", { authorization: state, propertyId: "111" });
    await expect(d.service.link(admin, "p1", "s1", { authorization: state, propertyId: "111" })).rejects.toMatchObject({ category: "not-found" });
  });
});

describe("unlinking an Analytics property", () => {
  it("deletes the traffic data through the repository and audits it", async () => {
    const d = fixture();
    await d.service.unlink(admin, "p1", "s1");
    expect(d.sites.unlinkAnalytics).toHaveBeenCalledWith(expect.anything(), "s1");
    expect(d.audit.append).toHaveBeenCalled();
  });

  it("refuses clients", async () => {
    await expect(fixture().service.unlink(client, "p1", "s1")).rejects.toMatchObject({ category: "forbidden" });
  });
});
