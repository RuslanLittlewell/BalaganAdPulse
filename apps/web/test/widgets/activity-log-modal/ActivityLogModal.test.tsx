import { render, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { ActivityLogModal } from "@/widgets/activity-log-modal/index.js";
import { hookWrapper, server } from "@test/shared/index.js";

describe("ActivityLogModal", () => {
  it("shows the actor, action, summary, changes and relative time", async () => {
    server.use(http.get("/api/audit", () => HttpResponse.json({
      items: [{
        id: "11111111-1111-4111-8111-111111111111",
        orgId: "22222222-2222-4222-8222-222222222222",
        actorId: "33333333-3333-4333-8333-333333333333",
        actorName: "Мария",
        actorEmail: "maria@example.com",
        actorRole: "MANAGER",
        action: "UPDATE",
        entityType: "campaignRecord",
        entityId: "44444444-4444-4444-8444-444444444444",
        clientId: null,
        projectId: null,
        campaignId: null,
        summary: "Изменён день 31 августа",
        changes: [{ field: "Расход", before: 100, after: 125 }],
        requestId: null,
        ip: null,
        userAgent: null,
        createdAt: new Date(Date.now() - 60_000).toISOString(),
      }],
      nextCursor: null,
    })));

    render(<ActivityLogModal open onOpenChange={() => undefined} />, {
      wrapper: hookWrapper(),
    });

    expect(await screen.findByText("Мария")).toBeInTheDocument();
    expect(screen.getByText("Изменение")).toBeInTheDocument();
    expect(screen.getByText("Изменён день 31 августа")).toBeInTheDocument();
    expect(screen.getByText(/Расход/).closest("li")).toHaveTextContent("100 → 125");
    expect(screen.getByText(/назад/)).toBeInTheDocument();
  });
});
