import { describe, expect, it, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { aSession, makeAccessToken, server } from "@test/shared/index.js";
import { clearTokens, writeTokens } from "@/shared/lib/index.js";
import { App } from "@/app/App.js";

function signedInAs(role: string, status: { enabled: boolean; required: boolean }) {
  server.use(
    http.get("/api/auth/me", () => HttpResponse.json(aSession({ role: role as never }))),
    http.get("/api/two-factor", () => HttpResponse.json({ ...status, backupCodesLeft: 0 })),
  );
}

beforeEach(() => {
  clearTokens();
  writeTokens({ accessToken: makeAccessToken(), refreshToken: "r" });
  window.history.pushState({}, "", "/projects");
});

describe("an organization that requires two-factor sign-in", () => {
  it("shows an employee without it the setup screen instead of the app", async () => {
    signedInAs("MANAGER", { enabled: false, required: true });
    render(<App />);

    expect(await screen.findByRole("heading", { name: "Включите двухфакторную защиту" })).toBeInTheDocument();
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });

  it("lets an enrolled employee into the app", async () => {
    signedInAs("MANAGER", { enabled: true, required: true });
    render(<App />);

    expect(await screen.findByRole("button", { name: "Уведомления" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Включите двухфакторную защиту" })).not.toBeInTheDocument();
  });
});
