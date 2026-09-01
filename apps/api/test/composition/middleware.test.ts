import { describe, expect, it } from "vitest";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import { AppError } from "../../src/shared/domain/app-error.js";
import type { ActorContext } from "../../src/shared/application/index.js";
import type { SessionPrincipal } from "../../src/modules/identity/index.js";
import { createAuthentication } from "../../src/modules/identity/presentation/http/authentication.js";
import { createActorResolution } from "../../src/modules/members/presentation/http/actor-resolution.js";

const PRINCIPAL: SessionPrincipal = { id: "u1", name: "Buyer", email: "buyer@acme.com" };
const ACTOR: ActorContext = { userId: "u1", membershipId: "m1", orgId: "org1", role: "MANAGER" };

/** A request carrying only what the middleware under test is allowed to read.
 * Express looks headers up case-insensitively, and so does this. */
function requestWith(headers: Record<string, string> = {}, extra: Record<string, unknown> = {}) {
  const lower = Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]),
  );
  return {
    header: (name: string) => lower[name.toLowerCase()],
    ...extra,
  } as unknown as Request & Record<string, unknown>;
}

/** Runs one middleware to completion and reports what it did: what it put on
 * the request, and what it handed to `next`. */
async function invoke(handler: RequestHandler, request: Request) {
  const error = await new Promise<unknown>((resolve) => {
    void handler(request, {} as Response, ((value?: unknown) => resolve(value)) as NextFunction);
  });
  return { request: request as Request & Record<string, unknown>, error };
}

describe("authentication middleware", () => {
  it("resolves a SessionPrincipal from the bearer token and puts it on the request", async () => {
    const middleware = createAuthentication({ authenticate: async () => PRINCIPAL });
    const { request, error } = await invoke(
      middleware,
      requestWith({ Authorization: "Bearer good-token" }),
    );

    expect(error).toBeUndefined();
    expect(request.principal).toEqual(PRINCIPAL);
  });

  it("carries the name and email the audit trail snapshots, not just an id", async () => {
    const middleware = createAuthentication({ authenticate: async () => PRINCIPAL });
    const { request } = await invoke(middleware, requestWith({ Authorization: "Bearer good-token" }));

    expect(request.principal).toMatchObject({ name: "Buyer", email: "buyer@acme.com" });
  });

  it("hands the port the token alone, without the scheme", async () => {
    const seen: string[] = [];
    const middleware = createAuthentication({
      authenticate: async (token) => { seen.push(token); return PRINCIPAL; },
    });
    await invoke(middleware, requestWith({ Authorization: "Bearer abc.def.ghi" }));

    expect(seen).toEqual(["abc.def.ghi"]);
  });

  it("refuses a request with no Authorization header, without consulting the port", async () => {
    let calls = 0;
    const middleware = createAuthentication({
      authenticate: async () => { calls += 1; return PRINCIPAL; },
    });
    const { request, error } = await invoke(middleware, requestWith());

    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).category).toBe("unauthorized");
    expect(request.principal).toBeUndefined();
    expect(calls).toBe(0);
  });

  it("refuses a scheme that is not Bearer, without consulting the port", async () => {
    let calls = 0;
    const middleware = createAuthentication({
      authenticate: async () => { calls += 1; return PRINCIPAL; },
    });
    const { error } = await invoke(middleware, requestWith({ Authorization: "Basic abc" }));

    expect((error as AppError).category).toBe("unauthorized");
    expect(calls).toBe(0);
  });

  it("gives a rejected token the same answer whatever was wrong with it", async () => {
    const reject = (message: string) => createAuthentication({
      authenticate: async () => { throw new AppError("unauthorized", message); },
    });
    const expired = await invoke(reject("expired"), requestWith({ Authorization: "Bearer a" }));
    const tampered = await invoke(reject("tampered"), requestWith({ Authorization: "Bearer b" }));

    expect((expired.error as AppError).category).toBe("unauthorized");
    expect((tampered.error as AppError).category).toBe("unauthorized");
    expect(expired.request.principal).toBeUndefined();
    expect(tampered.request.principal).toBeUndefined();
  });
});

describe("actor resolution middleware", () => {
  it("resolves an ActorContext for the authenticated principal", async () => {
    const middleware = createActorResolution({ resolveActor: async () => ACTOR });
    const { request, error } = await invoke(
      middleware,
      requestWith({}, { principal: PRINCIPAL }),
    );

    expect(error).toBeUndefined();
    expect(request.actor).toEqual(ACTOR);
  });

  it("hands the membership port the principal authentication resolved", async () => {
    const seen: SessionPrincipal[] = [];
    const middleware = createActorResolution({
      resolveActor: async (principal) => { seen.push(principal); return ACTOR; },
    });
    await invoke(middleware, requestWith({}, { principal: PRINCIPAL }));

    expect(seen).toEqual([PRINCIPAL]);
  });

  /** The whole reason the role is not sealed into the access token: a demotion
   * has to bite on the very next call, so the membership is asked every time
   * rather than remembered from the last one. */
  it("asks the membership port again on every request", async () => {
    const roles = ["ADMIN", "GUEST"] as const;
    let call = 0;
    const middleware = createActorResolution({
      resolveActor: async () => ({ ...ACTOR, role: roles[call++] }),
    });

    const first = await invoke(middleware, requestWith({}, { principal: PRINCIPAL }));
    const second = await invoke(middleware, requestWith({}, { principal: PRINCIPAL }));

    expect((first.request.actor as ActorContext).role).toBe("ADMIN");
    expect((second.request.actor as ActorContext).role).toBe("GUEST");
    expect(call).toBe(2);
  });

  it("refuses a principal who is not an active member", async () => {
    const middleware = createActorResolution({
      resolveActor: async () => {
        throw new AppError("forbidden", "Your account is not an active member of this organization");
      },
    });
    const { request, error } = await invoke(middleware, requestWith({}, { principal: PRINCIPAL }));

    expect((error as AppError).category).toBe("forbidden");
    expect(request.actor).toBeUndefined();
  });

  it("refuses a request that reached it with no principal, without consulting the port", async () => {
    let calls = 0;
    const middleware = createActorResolution({
      resolveActor: async () => { calls += 1; return ACTOR; },
    });
    const { request, error } = await invoke(middleware, requestWith());

    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).category).toBe("unauthorized");
    expect(request.actor).toBeUndefined();
    expect(calls).toBe(0);
  });
});
