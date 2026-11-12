import type { ReactNode } from "react";
import { http as mock, HttpResponse } from "msw";
import { renderHook } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { server, makeAccessToken } from "@test/shared/index.js";
import {
  ApiError, enterShareScope, http, leaveShareScope, onSessionExpired, projectPath, ShareScopeContext, writeTokens,
} from "@/shared/lib/index.js";
import { useActiveCampaignId, useActiveProjectId } from "@/entities/project/index.js";
import { usePreviewMode } from "@/features/preview-mode/index.js";
import { SharedAuthProvider, useModuleEnabled } from "@/features/auth/index.js";
import { useCan } from "@/features/permissions/index.js";

const TOKEN = "t".repeat(43);

afterEach(() => leaveShareScope());

function scoped(route: string) {
  return ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[route]}>
      <ShareScopeContext.Provider value={{ token: TOKEN, projectId: "p1" }}>
        <SharedAuthProvider modules={["DASHBOARD", "PROJECTS", "CRM"]}>{children}</SharedAuthProvider>
      </ShareScopeContext.Provider>
    </MemoryRouter>
  );
}

describe("requests under a share link", () => {
  it("go under the link's address and carry no cookies", async () => {
    let credentials: RequestCredentials | undefined;
    server.use(mock.get(`/api/shared/${TOKEN}/projects/p1/summary`, ({ request }) => {
      credentials = request.credentials;
      return HttpResponse.json({ spend: "1.0000" });
    }));
    enterShareScope(TOKEN);

    expect(await http.get("/projects/p1/summary")).toEqual({ spend: "1.0000" });
    expect(credentials).toBe("omit");
  });

  it("fetch files under the link's address too", async () => {
    let served = false;
    server.use(mock.get(`/api/shared/${TOKEN}/ad-creatives/c1/file`, () => {
      served = true;
      return HttpResponse.arrayBuffer(new ArrayBuffer(8), { headers: { "Content-Type": "image/png" } });
    }));
    enterShareScope(TOKEN);

    const file = await http.getBlob("/ad-creatives/c1/file");

    expect(served).toBe(true);
    expect(file.size).toBe(8);
  });

  it("neither renew a session nor end it when the link answers 401", async () => {
    writeTokens({ accessToken: makeAccessToken(), refreshToken: "r" });
    let refreshed = false;
    const ended = vi.fn();
    const stop = onSessionExpired(ended);
    server.use(
      mock.get(`/api/shared/${TOKEN}/projects/p1/kpis`, () => HttpResponse.json({ error: { message: "no" } }, { status: 401 })),
      mock.post("/api/auth/refresh", () => {
        refreshed = true;
        return HttpResponse.json({});
      }),
    );
    enterShareScope(TOKEN);

    await expect(http.get("/projects/p1/kpis")).rejects.toBeInstanceOf(ApiError);
    expect(refreshed).toBe(false);
    expect(ended).not.toHaveBeenCalled();
    stop();
  });

  it("go back to the member's address once the link is left", async () => {
    server.use(mock.get("/api/projects/p1/kpis", () => HttpResponse.json([])));
    enterShareScope(TOKEN);
    leaveShareScope();

    expect(await http.get("/projects/p1/kpis")).toEqual([]);
  });
});

describe("addresses under a share link", () => {
  it("lead to the shared project and its campaigns", () => {
    enterShareScope(TOKEN);

    expect(projectPath("p1")).toBe(`/share/${TOKEN}`);
    expect(projectPath("p1", "c1")).toBe(`/share/${TOKEN}/campaigns/c1`);
  });

  it("lead to the project pages again once the link is left", () => {
    expect(projectPath("p1", "c1")).toBe("/projects/p1/campaigns/c1");
  });
});

describe("hooks under a share link", () => {
  it("take the project from the link and the campaign from the shared address", () => {
    const project = renderHook(() => useActiveProjectId(), { wrapper: scoped(`/share/${TOKEN}`) });
    const campaign = renderHook(() => useActiveCampaignId(), { wrapper: scoped(`/share/${TOKEN}/campaigns/c1`) });

    expect(project.result.current).toBe("p1");
    expect(campaign.result.current).toBe("c1");
    expect(renderHook(() => useActiveCampaignId(), { wrapper: scoped(`/share/${TOKEN}`) }).result.current).toBeUndefined();
  });

  it("show the page in preview without a preview parameter, and offer no way out of it", () => {
    const { result } = renderHook(() => usePreviewMode(), { wrapper: scoped(`/share/${TOKEN}`) });

    expect(result.current.previewing).toBe(true);
  });

  it("allow nothing, while the modules follow the link", () => {
    const { result } = renderHook(() => ({
      reads: useCan("read", "campaign"),
      edits: useCan("update", "kpi"),
      crm: useModuleEnabled("CRM"),
      tasks: useModuleEnabled("TASKS"),
    }), { wrapper: scoped(`/share/${TOKEN}`) });

    expect(result.current).toEqual({ reads: false, edits: false, crm: true, tasks: false });
  });
});
