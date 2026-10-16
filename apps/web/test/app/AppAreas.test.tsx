import { describe, it, expect, beforeEach } from "vitest";
import { http as mock, HttpResponse } from "msw";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { clearTokens, hasSession, writeTokens } from "@/shared/lib/index.js";
import {
  aPlatformAdminSession,
  aPlatformOrganization,
  aSession,
  makeAccessToken,
  server,
} from "@test/shared/index.js";
import { App } from "@/app/App.js";

function signedInAt(path: string, session: ReturnType<typeof aSession>) {
  server.use(mock.get("/api/auth/me", () => HttpResponse.json(session)));
  writeTokens({ accessToken: makeAccessToken(), refreshToken: "r" });
  window.history.pushState({}, "", path);
  return render(<App />);
}

beforeEach(() => {
  clearTokens();
  window.history.pushState({}, "", "/");
});

describe("the platform administrator's area", () => {
  beforeEach(() => {
    server.use(mock.get("/api/platform/organizations", () => HttpResponse.json([aPlatformOrganization()])));
  });

  it("lands on the organizations table with a single module in the navigation", async () => {
    signedInAt("/", aPlatformAdminSession());

    expect(await screen.findByRole("heading", { name: "Организации" })).toBeInTheDocument();
    expect(await screen.findByRole("table", { name: "Организации платформы" })).toBeInTheDocument();
    const nav = screen.getByRole("navigation", { name: "Разделы" });
    expect(within(nav).getAllByRole("link").map((link) => link.textContent)).toEqual(["Организации"]);
    expect(window.location.pathname).toBe("/organizations");
  });

  it("sends an organization route back to the organizations table", async () => {
    signedInAt("/projects", aPlatformAdminSession());

    expect(await screen.findByRole("heading", { name: "Организации" })).toBeInTheDocument();
    expect(window.location.pathname).toBe("/organizations");
    expect(screen.queryByRole("link", { name: "Проекты" })).not.toBeInTheDocument();
  });

  it("asks for nothing that belongs to an organization", async () => {
    const asked: string[] = [];
    server.use(
      mock.get("/api/members", () => { asked.push("members"); return HttpResponse.json([]); }),
      mock.get("/api/projects", () => { asked.push("projects"); return HttpResponse.json([]); }),
    );
    signedInAt("/", aPlatformAdminSession());

    await screen.findByRole("table", { name: "Организации платформы" });
    expect(asked).toEqual([]);
  });

  it("offers signing out but no profile settings", async () => {
    signedInAt("/", aPlatformAdminSession());

    await userEvent.click(await screen.findByRole("button", { name: /Платформа/ }));

    expect(screen.getByRole("menuitem", { name: "Выйти" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Настройки" })).not.toBeInTheDocument();
  });
});

describe("a member of a suspended organization", () => {
  const suspended = aSession({
    organization: { id: "org-1", name: "Balagan", slug: "balagan", status: "SUSPENDED" },
    modules: [],
  });

  it("sees that access is suspended instead of the application", async () => {
    signedInAt("/projects", suspended);

    expect(await screen.findByRole("heading", { name: "Доступ приостановлен" })).toBeInTheDocument();
    expect(screen.getByText("Balagan")).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Разделы" })).not.toBeInTheDocument();
  });

  it("can only sign out", async () => {
    server.use(mock.post("/api/auth/logout", () => new HttpResponse(null, { status: 204 })));
    signedInAt("/", suspended);

    await userEvent.click(await screen.findByRole("button", { name: "Выйти" }));

    await waitFor(() => expect(hasSession()).toBe(false));
  });
});

describe("an organization without some modules", () => {
  const withoutTasks = aSession({ modules: ["DASHBOARD", "PROJECTS", "CRM"] });

  it("leaves the missing modules out of the navigation", async () => {
    signedInAt("/", withoutTasks);

    const nav = await screen.findByRole("navigation", { name: "Разделы" });
    await within(nav).findByRole("link", { name: "CRM" });
    expect(within(nav).getAllByRole("link").map((link) => link.textContent))
      .toEqual(["Дашборд", "CRM", "Проекты", "Архив"]);
  });

  it("sends a disabled module's address to the dashboard", async () => {
    signedInAt("/tasks", withoutTasks);

    await screen.findByRole("link", { name: "CRM" });
    await waitFor(() => expect(window.location.pathname).toBe("/"));
  });

  it("sends a disabled reports address to the dashboard too", async () => {
    signedInAt("/reports/r1", withoutTasks);

    await screen.findByRole("link", { name: "CRM" });
    await waitFor(() => expect(window.location.pathname).toBe("/"));
  });
});
