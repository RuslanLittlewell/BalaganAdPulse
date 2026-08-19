import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import { writeTokens } from "../../lib/auth/tokenStore.js";
import { makeAccessToken } from "../../test/token.js";
import { RequireAuth } from "./RequireAuth.js";

function LoginProbe() {
  const location = useLocation();
  const state = location.state as { from?: string } | null;
  return <span>login from {state?.from ?? "nowhere"}</span>;
}

function renderAt(route: string) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path="/login" element={<LoginProbe />} />
        <Route
          path="/clients/:clientId"
          element={<RequireAuth><span>protected</span></RequireAuth>}
        />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => localStorage.clear());

describe("RequireAuth", () => {
  it("redirects to sign-in without a session", () => {
    renderAt("/clients/c1");
    expect(screen.getByText(/^login from/)).toBeInTheDocument();
  });

  it("remembers where the visitor was going", () => {
    renderAt("/clients/c1");
    expect(screen.getByText("login from /clients/c1")).toBeInTheDocument();
  });

  it("renders the page with a session", () => {
    writeTokens({ accessToken: makeAccessToken(), refreshToken: "r" });
    renderAt("/clients/c1");
    expect(screen.getByText("protected")).toBeInTheDocument();
  });

  it("renders the page when only the refresh token survived", () => {
    localStorage.setItem("adpulse.refreshToken", "r");
    renderAt("/clients/c1");
    expect(screen.getByText("protected")).toBeInTheDocument();
  });
});
