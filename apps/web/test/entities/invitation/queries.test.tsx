import { http as mock, HttpResponse } from "msw";
import { act, renderHook, waitFor } from "@testing-library/react";
import { hookWrapper, server } from "@test/shared/index.js";
import {
  useCreateInvitation,
  useInvitations,
  useRevokeInvitation,
  type Invitation,
} from "@/entities/invitation/index.js";

const invitation = (partial: Partial<Invitation> = {}): Invitation => ({
  id: "invite-1", code: "ABCDEFGH", registrationType: "EMPLOYEE", role: "MANAGER",
  projectIds: ["project-1"], email: null, expiresAt: null, revokedAt: null, usedAt: null,
  status: "PENDING", registrationUrl: "/regustration/ABCDEFGH",
  createdAt: "2026-09-01T00:00:00.000Z",
  ...partial,
});

describe("listing invitations", () => {
  it("asks for every pending invitation when no type is given", async () => {
    let seen: string | null = "unset";
    server.use(mock.get("/api/invites", ({ request }) => {
      seen = new URL(request.url).searchParams.get("registrationType");
      return HttpResponse.json([invitation()]);
    }));

    const { result } = renderHook(() => useInvitations(), { wrapper: hookWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(seen).toBeNull();
  });

  it("filters by registration type", async () => {
    let seen: string | null = null;
    server.use(mock.get("/api/invites", ({ request }) => {
      seen = new URL(request.url).searchParams.get("registrationType");
      return HttpResponse.json([invitation({ registrationType: "CLIENT", role: null })]);
    }));

    const { result } = renderHook(() => useInvitations("CLIENT"), { wrapper: hookWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(seen).toBe("CLIENT");
  });

  it("keeps each type's list under its own cache key", async () => {
    server.use(mock.get("/api/invites", ({ request }) => {
      const type = new URL(request.url).searchParams.get("registrationType");
      return HttpResponse.json([invitation({ id: `invite-${type}` })]);
    }));
    const wrapper = hookWrapper();

    const clients = renderHook(() => useInvitations("CLIENT"), { wrapper });
    const employees = renderHook(() => useInvitations("EMPLOYEE"), { wrapper });

    await waitFor(() => expect(clients.result.current.isSuccess).toBe(true));
    await waitFor(() => expect(employees.result.current.isSuccess).toBe(true));
    expect(clients.result.current.data![0]!.id).toBe("invite-CLIENT");
    expect(employees.result.current.data![0]!.id).toBe("invite-EMPLOYEE");
  });

  it("carries the backend's registration link through", async () => {
    server.use(mock.get("/api/invites", () => HttpResponse.json([invitation()])));

    const { result } = renderHook(() => useInvitations(), { wrapper: hookWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data![0]!.registrationUrl).toBe("/regustration/ABCDEFGH");
  });
});

describe("creating an invitation", () => {
  it("sends a client invitation with no role and no projects", async () => {
    let body: Record<string, unknown> | null = null;
    server.use(mock.post("/api/invites", async ({ request }) => {
      body = await request.json() as Record<string, unknown>;
      return HttpResponse.json(
        invitation({ registrationType: "CLIENT", role: null }), { status: 201 },
      );
    }));

    const { result } = renderHook(() => useCreateInvitation(), { wrapper: hookWrapper() });
    await act(async () => { await result.current.mutateAsync({ registrationType: "CLIENT" }); });

    expect(body).toEqual({ registrationType: "CLIENT" });
  });

  it("sends an employee invitation with its role and projects", async () => {
    let body: Record<string, unknown> | null = null;
    server.use(mock.post("/api/invites", async ({ request }) => {
      body = await request.json() as Record<string, unknown>;
      return HttpResponse.json(invitation(), { status: 201 });
    }));

    const { result } = renderHook(() => useCreateInvitation(), { wrapper: hookWrapper() });
    await act(async () => {
      await result.current.mutateAsync({
        registrationType: "EMPLOYEE", role: "GUEST", projectIds: ["project-1", "project-2"],
      });
    });

    expect(body).toEqual({
      registrationType: "EMPLOYEE", role: "GUEST", projectIds: ["project-1", "project-2"],
    });
  });

  it("refreshes every list once it succeeds", async () => {
    let lists = 0;
    server.use(
      mock.get("/api/invites", () => { lists += 1; return HttpResponse.json([]); }),
      mock.post("/api/invites", () => HttpResponse.json(invitation(), { status: 201 })),
    );
    const wrapper = hookWrapper();
    const list = renderHook(() => useInvitations("EMPLOYEE"), { wrapper });
    await waitFor(() => expect(list.result.current.isSuccess).toBe(true));
    const before = lists;

    const create = renderHook(() => useCreateInvitation(), { wrapper });
    await act(async () => {
      await create.result.current.mutateAsync({
        registrationType: "EMPLOYEE", role: "GUEST", projectIds: ["project-1"],
      });
    });

    await waitFor(() => expect(lists).toBeGreaterThan(before));
  });
});

describe("revoking an invitation", () => {
  it("refetches, and the revoked invitation is gone", async () => {
    let revoked = false;
    server.use(
      mock.get("/api/invites", () => HttpResponse.json(revoked ? [] : [invitation()])),
      mock.delete("/api/invites/:id", () => {
        revoked = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const wrapper = hookWrapper();
    const list = renderHook(() => useInvitations("EMPLOYEE"), { wrapper });
    await waitFor(() => expect(list.result.current.data).toHaveLength(1));

    const revoke = renderHook(() => useRevokeInvitation(), { wrapper });
    await act(async () => { await revoke.result.current.mutateAsync("invite-1"); });

    await waitFor(() => expect(list.result.current.data).toEqual([]));
  });
});
