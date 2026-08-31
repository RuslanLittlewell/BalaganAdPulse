import { http as mock, HttpResponse } from "msw";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Routes, Route } from "react-router-dom";
import { aClient, aProject, server } from "@test/shared/index.js";
import { renderWithProviders } from "@test/shared/index.js";
import { ProjectPage } from "@/pages/project/ProjectPage.js";
import { EmptyState } from "@/shared/ui/index.js";

const client = aClient({ name: "Acme" });
const project = aProject({ id: "1", clientId: "1", name: "Летний запуск" });

function setup(route: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/projects" element={<EmptyState title="root" />} />
      <Route path="/projects/:projectId" element={<ProjectPage />} />
      <Route path="/projects/:projectId/campaigns/:campaignId" element={<ProjectPage />} />
    </Routes>,
    { route },
  );
}

describe("ProjectPage", () => {
  it("shows the selected client's header", async () => {
    server.use(mock.get("/api/clients", () => HttpResponse.json([client])),
      mock.get("/api/projects", () => HttpResponse.json([project])));
    setup("/projects/1");
    expect(await screen.findByRole("heading", { name: "Летний запуск" })).toBeInTheDocument();
  });

  it("shows a not-found state for an unknown id", async () => {
    server.use(mock.get("/api/clients", () => HttpResponse.json([client])),
      mock.get("/api/projects", () => HttpResponse.json([project])));
    setup("/projects/999");
    expect(await screen.findByText("Проект не найден")).toBeInTheDocument();
  });

  it("carries no edit or delete control: those moved into the list", async () => {
    server.use(
      mock.get("/api/clients", () => HttpResponse.json([client])),
      mock.get("/api/projects", () => HttpResponse.json([project])),
    );
    setup("/projects/1");
    await screen.findByRole("heading", { name: "Летний запуск" });

    expect(screen.queryByRole("button", { name: "Редактировать" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Удалить" })).not.toBeInTheDocument();
  });

  it("redirects to the first campaign when the URL has none", async () => {
    server.use(
      mock.get("/api/clients", () => HttpResponse.json([client])),
      mock.get("/api/projects", () => HttpResponse.json([project])),
      mock.get("/api/projects/1/campaigns", () =>
        HttpResponse.json([
          { id: "c1", clientId: "1", name: "Search ads", position: 0, createdAt: "", updatedAt: "" },
        ]),
      ),
      mock.get("/api/campaigns/c1", () =>
        HttpResponse.json({
          id: "c1", clientId: "1", name: "Search ads", position: 0,
          properties: [], records: [], totals: {},
        }),
      ),
    );

    setup("/projects/1");

    expect(await screen.findByRole("tab", { name: "Search ads" })).toHaveAttribute("aria-selected", "true");
  });

  it("shows an empty state when the client has no campaigns", async () => {
    server.use(
      mock.get("/api/clients", () => HttpResponse.json([client])),
      mock.get("/api/projects", () => HttpResponse.json([project])),
      mock.get("/api/projects/1/campaigns", () => HttpResponse.json([])),
    );

    setup("/projects/1");

    expect(await screen.findByText("Листов пока нет")).toBeInTheDocument();
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
  });

  it("shows an error state with retry when campaigns fail to load", async () => {
    server.use(
      mock.get("/api/clients", () => HttpResponse.json([client])),
      mock.get("/api/projects", () => HttpResponse.json([project])),
      mock.get("/api/projects/1/campaigns", () => new HttpResponse(null, { status: 500 })),
    );

    setup("/projects/1");

    expect(await screen.findByText("Что-то пошло не так")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Повторить" })).toBeInTheDocument();
  });

  it("creates a sheet from the empty state and opens it", async () => {
    const created = {
      id: "c9", clientId: "1", name: "Main", position: 0, createdAt: "", updatedAt: "",
    };
    let listed: unknown[] = [];
    server.use(
      mock.get("/api/clients", () => HttpResponse.json([client])),
      mock.get("/api/projects", () => HttpResponse.json([project])),
      mock.get("/api/projects/1/campaigns", () => HttpResponse.json(listed)),
      mock.post("/api/projects/1/campaigns", () => {
        listed = [created];
        return HttpResponse.json(created, { status: 201 });
      }),
      mock.get("/api/campaigns/c9", () =>
        HttpResponse.json({ ...created, properties: [], records: [], totals: {} }),
      ),
    );

    setup("/projects/1");

    await userEvent.click(await screen.findByRole("button", { name: "Создать лист" }));
    await userEvent.type(screen.getByLabelText("Имя"), "Main");
    await userEvent.click(screen.getByRole("button", { name: "Создать" }));

    expect(await screen.findByRole("tab", { name: "Main" })).toHaveAttribute("aria-selected", "true");
  });

  it("opens the rename dialog prefilled from the pencil, and saving renames the tab", async () => {
    let listed: unknown[] = [
      { id: "c1", clientId: "1", name: "Search ads", position: 0, createdAt: "", updatedAt: "" },
    ];
    server.use(
      mock.get("/api/clients", () => HttpResponse.json([client])),
      mock.get("/api/projects", () => HttpResponse.json([project])),
      mock.get("/api/projects/1/campaigns", () => HttpResponse.json(listed)),
      mock.get("/api/campaigns/c1", () =>
        HttpResponse.json({
          id: "c1", clientId: "1", name: "Search ads", position: 0,
          properties: [], records: [], totals: {},
        }),
      ),
      mock.patch("/api/campaigns/c1", () => {
        const renamed = { id: "c1", clientId: "1", name: "Renamed", position: 0, createdAt: "", updatedAt: "" };
        listed = [renamed];
        return HttpResponse.json(renamed);
      }),
    );

    setup("/projects/1");

    await userEvent.click(await screen.findByRole("button", { name: "Переименовать лист" }));

    const nameField = screen.getByLabelText("Имя");
    expect(nameField).toHaveValue("Search ads");
    expect(screen.getByRole("button", { name: "Сохранить" })).toBeInTheDocument();

    await userEvent.clear(nameField);
    await userEvent.type(nameField, "Renamed");
    await userEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    expect(await screen.findByRole("tab", { name: "Renamed" })).toBeInTheDocument();
  });

  it("deletes a sheet from its dialog and opens the neighbouring one", async () => {
    let listed = [
      { id: "c1", projectId: "1", name: "Search ads", position: 0, createdAt: "", updatedAt: "" },
      { id: "c2", projectId: "1", name: "Display", position: 1, createdAt: "", updatedAt: "" },
    ];
    const table = (id: string, name: string) => ({
      id, projectId: "1", name, position: 0, properties: [], records: [], totals: {},
    });
    server.use(
      mock.get("/api/clients", () => HttpResponse.json([client])),
      mock.get("/api/projects", () => HttpResponse.json([project])),
      mock.get("/api/projects/1/campaigns", () => HttpResponse.json(listed)),
      mock.get("/api/campaigns/c1", () => HttpResponse.json(table("c1", "Search ads"))),
      mock.get("/api/campaigns/c2", () => HttpResponse.json(table("c2", "Display"))),
      mock.delete("/api/campaigns/c2", () => {
        listed = [listed[0]];
        return new HttpResponse(null, { status: 204 });
      }),
    );

    setup("/projects/1/campaigns/c2");

    await userEvent.click(await screen.findByRole("button", { name: "Переименовать лист" }));
    await userEvent.click(await screen.findByRole("button", { name: "Удалить лист" }));
    const confirmation = await screen.findByRole("alertdialog");
    await userEvent.click(within(confirmation).getByRole("button", { name: "Удалить" }));

    expect(await screen.findByRole("tab", { name: "Search ads" })).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByRole("tab", { name: "Display" })).not.toBeInTheDocument();
  });

  it("selects the first sheet without waiting for the address to catch up", async () => {
    const listed = [
      { id: "c1", projectId: "1", name: "Search ads", position: 0, createdAt: "", updatedAt: "" },
      { id: "c2", projectId: "1", name: "Display", position: 1, createdAt: "", updatedAt: "" },
    ];
    server.use(
      mock.get("/api/clients", () => HttpResponse.json([client])),
      mock.get("/api/projects", () => HttpResponse.json([project])),
      mock.get("/api/projects/1/campaigns", () => HttpResponse.json(listed)),
      mock.get("/api/campaigns/c1", () =>
        HttpResponse.json({ id: "c1", projectId: "1", name: "Search ads", position: 0, properties: [], records: [], totals: {} })),
    );

    // No sheet in the address: the tab and the sheet come from the list, not
    // from the redirect that follows.
    setup("/projects/1");

    expect(await screen.findByRole("tab", { name: "Search ads" }))
      .toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Display" })).toHaveAttribute("aria-selected", "false");
  });
});
