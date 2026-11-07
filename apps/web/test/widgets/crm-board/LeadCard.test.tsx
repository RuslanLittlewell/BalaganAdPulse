import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { aLead } from "@test/shared/fixtures.js";
import { LeadCard } from "@/widgets/crm-board/index.js";
import { DEFAULT_CARD_FIELDS } from "@/features/lead-view-options/index.js";
import type { LeadField } from "@/entities/lead/index.js";

const FIELDS: LeadField[] = [
  { id: "segment", name: "Сегмент", type: "SELECT", position: 0, options: [{ id: "o1", name: "Опт", color: "blue" }] },
  { id: "budget", name: "Бюджет", type: "NUMBER", position: 1, options: [] },
];

const lead = aLead({
  name: "Анна", company: { id: "c1", name: "Ромашка", website: null }, person: { id: "p1", name: "Анна", phone: null, email: "anna@example.com", telegram: null, messenger: null }, source: "Рекомендация",
  amount: "50000.0000", tags: ["VIP"], assigneeId: "member-1", assignee: { id: "member-1", name: "Мария", image: null },
  createdAt: "2026-03-10T09:00:00.000Z", customValues: { segment: "o1", budget: "1500.5000" },
});

const rowsOf = () => [...screen.getByTestId(`lead-card-${lead.id}`).querySelectorAll("[data-field]")].map((row) => row.getAttribute("data-field"));

describe("the board card", () => {
  it("shows the name and the default fields as icon rows, skipping empty ones", () => {
    render(<LeadCard lead={lead} fields={FIELDS} cardFields={DEFAULT_CARD_FIELDS} />);

    expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent("Анна");
    expect(rowsOf()).toEqual(["amount", "assignee", "company", "arrival", "tags"]);
    const card = screen.getByTestId(`lead-card-${lead.id}`);
    expect(within(card).getByText("50000")).toBeInTheDocument();
    expect(within(card).getByText("Мария")).toBeInTheDocument();
    expect(within(card).getByText("10.03.2026")).toBeInTheDocument();
    expect(within(card).getByText("VIP")).toBeInTheDocument();
  });

  it("names each row for assistive technology", () => {
    render(<LeadCard lead={lead} fields={FIELDS} cardFields={["amount", "custom:budget"]} />);

    const card = screen.getByTestId(`lead-card-${lead.id}`);
    expect(within(card.querySelector('[data-field="amount"]') as HTMLElement).getByText("Сумма сделки")).toBeInTheDocument();
    expect(within(card.querySelector('[data-field="custom:budget"]') as HTMLElement).getByText("Бюджет")).toBeInTheDocument();
  });

  it("follows the chosen order and shows custom values, a list value as a colored chip", () => {
    render(<LeadCard lead={lead} fields={FIELDS} cardFields={["custom:segment", "company", "custom:budget"]} />);

    expect(rowsOf()).toEqual(["custom:segment", "company", "custom:budget"]);
    expect(screen.getByText("Опт")).toHaveAttribute("data-color", "blue");
    expect(screen.getByText("1500.5")).toBeInTheDocument();
  });

  it("shows only the name in compact mode", () => {
    render(<LeadCard lead={lead} fields={FIELDS} cardFields={DEFAULT_CARD_FIELDS} compact />);

    expect(rowsOf()).toEqual([]);
    expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent("Анна");
  });

  it("never says that an imported lead came from Meta or names its campaign", () => {
    const imported = aLead({
      id: "imported", name: "Из формы", source: null, origin: "META", campaignId: "c1",
      metaSource: {
        accountId: "1", formId: "f", campaign: { externalId: "c", name: "Весна" }, adSet: { externalId: "s", name: "S" },
        ad: { externalId: "a", name: "A" }, submittedAt: "2026-03-10T09:00:00.000Z", answers: [], answersOmitted: false,
      },
    });
    render(<LeadCard lead={imported} fields={[]} cardFields={["source", "arrival"]} />);

    expect(screen.getByTestId("lead-card-imported")).not.toHaveTextContent(/Meta|Весна/);
  });

  it("opens on click, Enter and Space, but not from its email link", async () => {
    const onOpen = vi.fn();
    render(<LeadCard lead={lead} fields={FIELDS} cardFields={["email"]} onOpen={onOpen} />);

    await userEvent.click(screen.getByRole("link", { name: "anna@example.com" }));
    expect(onOpen).not.toHaveBeenCalled();

    const card = screen.getByRole("button", { name: "Открыть лид: Анна" });
    await userEvent.click(card);
    card.focus();
    await userEvent.keyboard("{Enter}");
    await userEvent.keyboard(" ");
    expect(onOpen).toHaveBeenCalledTimes(3);
  });

  it("offers its handle for dragging only when it may be dragged", () => {
    const { rerender } = render(<LeadCard lead={lead} draggable />);
    expect(screen.getByTestId(`lead-card-${lead.id}`)).toHaveAttribute("data-draggable", "true");
    expect(screen.getByTestId(`lead-drag-${lead.id}`)).toBeInTheDocument();

    rerender(<LeadCard lead={lead} />);
    expect(screen.getByTestId(`lead-card-${lead.id}`)).not.toHaveAttribute("data-draggable");
    expect(screen.queryByTestId(`lead-drag-${lead.id}`)).toBeNull();
  });
});
