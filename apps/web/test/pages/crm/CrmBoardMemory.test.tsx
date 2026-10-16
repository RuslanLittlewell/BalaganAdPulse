import { http as mock, HttpResponse } from "msw";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Link, Route, Routes, useLocation } from "react-router-dom";
import { renderWithProviders, server } from "@test/shared/index.js";
import { CrmPage } from "@/pages/crm/index.js";
import { useModuleMemory } from "@/shared/lib/index.js";

const capabilities = { create: true, update: true, delete: true };

function Address() {
  const location = useLocation();
  return <output aria-label="Адрес">{`${location.pathname}${location.search}`}</output>;
}

function App() {
  return (
    <>
      <nav>
        <Link to="/crm">CRM</Link>
        <Link to="/tasks">Задачи</Link>
      </nav>
      <Address />
      <Routes>
        <Route path="/crm" element={<CrmPage />} />
        <Route path="/tasks" element={<h1>Задачи</h1>} />
      </Routes>
    </>
  );
}

function boards(...list: { key: string; label: string }[]) {
  server.use(
    mock.get("/api/crm/boards", () => HttpResponse.json(list.map((board) => ({ ...board, capabilities })))),
    mock.get("/api/crm/boards/:board/leads", () => HttpResponse.json([])),
  );
}

const signedInAs = (id: string) => server.use(mock.get("/api/auth/me", () => HttpResponse.json({
  user: { id, name: "Buyer", email: `${id}@acme.com`, image: null },
  organization: { id: "org-1", name: "AdPulse", slug: "adpulse" },
  role: "ADMIN",
  clientIds: [],
})));

describe("the CRM board a member last selected", () => {
  it("opens again when the member comes back to CRM from another module", async () => {
    boards({ key: "project-1", label: "Сайт" }, { key: "project-2", label: "Реклама" });
    renderWithProviders(<App />, { route: "/crm" });

    await userEvent.click(await screen.findByLabelText("Воронка"));
    await userEvent.click(await screen.findByRole("option", { name: "Реклама" }));
    await waitFor(() => expect(screen.getByLabelText("Адрес")).toHaveTextContent("/crm?board=project-2"));

    await userEvent.click(screen.getByRole("link", { name: "Задачи" }));
    await screen.findByRole("heading", { name: "Задачи" });
    await userEvent.click(screen.getByRole("link", { name: "CRM" }));

    await waitFor(() => expect(screen.getByLabelText("Воронка")).toHaveTextContent("Реклама"));
    expect(screen.getByLabelText("Адрес")).toHaveTextContent("/crm?board=project-2");
  });

  it("survives a reload", async () => {
    boards({ key: "project-1", label: "Сайт" }, { key: "project-2", label: "Реклама" });
    useModuleMemory.setState({ boards: { "user-1": "project-2" } });
    renderWithProviders(<App />, { route: "/crm" });

    await waitFor(() => expect(screen.getByLabelText("Воронка")).toHaveTextContent("Реклама"));
    expect(JSON.parse(localStorage.getItem("adpulse-module-memory")!).state.boards).toEqual({ "user-1": "project-2" });
  });

  it("falls back to the default board and forgets a board the member no longer reaches", async () => {
    boards({ key: "project-1", label: "Сайт" }, { key: "project-2", label: "Реклама" });
    useModuleMemory.setState({ boards: { "user-1": "client-gone" } });
    renderWithProviders(<App />, { route: "/crm" });

    await waitFor(() => expect(screen.getByLabelText("Воронка")).toHaveTextContent("Сайт"));
    expect(screen.queryByText("Воронка недоступна")).not.toBeInTheDocument();
    await waitFor(() => expect(useModuleMemory.getState().boards["user-1"]).toBeUndefined());
  });

  it("does not open another person's remembered board", async () => {
    boards({ key: "project-1", label: "Сайт" }, { key: "project-2", label: "Реклама" });
    useModuleMemory.setState({ boards: { "user-1": "project-2" } });
    signedInAs("user-2");
    renderWithProviders(<App />, { route: "/crm" });

    const selector = await screen.findByLabelText("Воронка");
    await waitFor(() => expect(screen.getByLabelText("Адрес")).toHaveTextContent(/^\/crm$/));
    expect(selector).toHaveTextContent("Сайт");
    expect(useModuleMemory.getState().boards).toEqual({ "user-1": "project-2" });
  });

  it("lets a board in the address win and remembers it instead", async () => {
    boards({ key: "project-1", label: "Сайт" }, { key: "project-2", label: "Реклама" }, { key: "project-3", label: "Лютик" });
    useModuleMemory.setState({ boards: { "user-1": "project-2" } });
    renderWithProviders(<App />, { route: "/crm?board=project-3" });

    await waitFor(() => expect(screen.getByLabelText("Воронка")).toHaveTextContent("Лютик"));
    await waitFor(() => expect(useModuleMemory.getState().boards["user-1"]).toBe("project-3"));
  });
});
