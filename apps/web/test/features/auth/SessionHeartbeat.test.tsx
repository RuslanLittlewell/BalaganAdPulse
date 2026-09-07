import { http as mock, HttpResponse } from "msw";
import { waitFor } from "@testing-library/react";
import { renderWithProviders, server } from "@test/shared/index.js";
import { SESSION_HEARTBEAT_MS, SessionHeartbeat } from "@/features/auth/index.js";

const session = {
  user: { id: "user-1", name: "Buyer", email: "buyer@acme.com", image: null },
  organization: { id: "org-1", name: "AdPulse", slug: "adpulse" },
  role: "ADMIN",
  clientIds: [],
};

describe("the session heartbeat", () => {
  it("keeps saying the person is here while the dashboard is open", async () => {
    let asked = 0;
    server.use(mock.get("/api/auth/me", () => {
      asked += 1;
      return HttpResponse.json(session);
    }));

    renderWithProviders(<SessionHeartbeat everyMs={20} />);

    await waitFor(() => { expect(asked).toBeGreaterThanOrEqual(3); });
  });

  it("beats often enough that a missed beat does not put the person offline", () => {
    expect(SESSION_HEARTBEAT_MS * 2).toBeLessThan(5 * 60_000);
  });
});
