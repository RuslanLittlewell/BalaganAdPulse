import { http as mock, HttpResponse } from "msw";
import { screen } from "@testing-library/react";
import { renderWithProviders, server } from "@test/shared/index.js";
import { StaffSync, resetStaff, useMembers } from "@/entities/membership/index.js";

const staff = [{
  id: "membership-1", userId: "user-1", name: "Мария", email: "maria@acme.by",
  image: null, phone: null, telegram: null, role: "MANAGER", status: "ACTIVE",
  createdAt: "2026-09-01T00:00:00.000Z",
}];

let asked = 0;

function Roster({ label }: { label: string }) {
  const { data } = useMembers();
  return <p>{label}: {(data ?? []).map((member) => member.name).join(", ")}</p>;
}

beforeEach(() => {
  asked = 0;
  server.use(mock.get("/api/members", () => {
    asked += 1;
    return HttpResponse.json(staff);
  }));
});

describe("the staff store", () => {
  it("asks the API once however many screens read the staff", async () => {
    renderWithProviders(<><Roster label="Задачи" /><Roster label="Модули" /></>);

    expect(await screen.findByText("Задачи: Мария")).toBeInTheDocument();
    expect(await screen.findByText("Модули: Мария")).toBeInTheDocument();
    expect(asked).toBe(1);
  });

  it("serves a screen opened later from the store, without asking again", async () => {
    const first = renderWithProviders(<Roster label="Задачи" />);
    await screen.findByText("Задачи: Мария");
    first.unmount();

    renderWithProviders(<Roster label="Модули" />);

    expect(await screen.findByText("Модули: Мария")).toBeInTheDocument();
    expect(asked).toBe(1);
  });

  it("forgets the staff when the session ends", async () => {
    renderWithProviders(<Roster label="Задачи" />);
    await screen.findByText("Задачи: Мария");

    resetStaff();
    renderWithProviders(<Roster label="Модули" />);

    expect(await screen.findByText("Модули: Мария")).toBeInTheDocument();
    expect(asked).toBe(2);
  });

  it("drops what it holds when the session it was loaded for ends", async () => {
    const dashboard = renderWithProviders(<><StaffSync /><Roster label="Задачи" /></>);
    await screen.findByText("Задачи: Мария");
    dashboard.unmount();

    renderWithProviders(<><StaffSync /><Roster label="Модули" /></>);

    expect(await screen.findByText("Модули: Мария")).toBeInTheDocument();
    expect(asked).toBe(2);
  });

  it("reports the wait so a screen can show its loader", async () => {
    function Waiting() {
      const { isPending, isSuccess } = useMembers();
      return <p>{isPending ? "ждём" : isSuccess ? "готово" : "ошибка"}</p>;
    }
    renderWithProviders(<Waiting />);

    expect(screen.getByText("ждём")).toBeInTheDocument();
    expect(await screen.findByText("готово")).toBeInTheDocument();
  });
});
