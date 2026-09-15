import { render, screen } from "@testing-library/react";
import { LeadCard } from "@/widgets/crm-board/index.js";
import type { Lead } from "@/entities/lead/index.js";

const lead: Lead = {
  id: "lead-1", orgId: "org-1", clientId: "client-1", name: "Анна",
  company: "Скрытая компания", phone: "+375291112233", email: "anna@example.com",
  website: null, source: "Рекомендация", notes: null,
  projectId: "project-1", project: { id: "project-1", clientId: "client-1", name: "Летний запуск" },
  campaignId: null, adId: null, origin: "MANUAL", ad: null, metaSource: null,
  assigneeId: "member-1", assignee: { id: "member-1", name: "Мария", image: null },
  stage: "NEW", position: 0,
  createdAt: "2026-09-05T00:00:00.000Z", updatedAt: "2026-09-05T00:00:00.000Z",
};

describe("LeadCard", () => {
  it("shows readable project, email and assignee details without company or phone", () => {
    render(<LeadCard lead={lead} />);

    expect(screen.getByTestId("lead-project-lead-1")).toHaveTextContent("Летний запуск");
    expect(screen.getByTestId("lead-assignee-lead-1")).toHaveTextContent("Мария");
    expect(screen.getByRole("link", { name: "anna@example.com" })).toBeInTheDocument();
    expect(screen.queryByText("Скрытая компания")).toBeNull();
    expect(screen.queryByText("+375291112233")).toBeNull();
  });

  it("uses a grab cursor while it can be dragged", () => {
    render(<LeadCard lead={lead} draggable />);
    expect(screen.getByTestId("lead-card-lead-1")).toHaveClass("cursor-grab");
    expect(screen.getByTestId("lead-drag-lead-1")).toHaveClass("cursor-grab");
  });
});
