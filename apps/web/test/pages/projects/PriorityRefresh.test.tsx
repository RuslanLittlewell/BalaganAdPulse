import { http, HttpResponse } from "msw";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { aClient, aProject, renderWithProviders, server } from "@test/shared/index.js";
import { ProjectsPage } from "@/pages/projects/ProjectsPage.js";

describe("changing a project's priority from its context menu", () => {
  it("keeps the open project and the list on screen while the list reloads", async () => {
    const user = userEvent.setup();
    let stored = aProject({ id: "p1", clientId: "1", name: "Летний запуск", priority: "IDLE" });
    let release: () => void = () => {};
    let reloading = false;
    let loads = 0;
    server.use(
      http.get("/api/clients", () => HttpResponse.json([aClient({ id: "1", name: "Acme" })])),
      http.get("/api/projects/p1/campaigns", () => HttpResponse.json([])),
      http.get("/api/projects", async () => {
        loads += 1;
        if (loads > 1) {
          reloading = true;
          await new Promise<void>((resolve) => { release = resolve; });
        }
        return HttpResponse.json([stored]);
      }),
      http.patch("/api/projects/p1", async ({ request }) => {
        stored = { ...stored, ...(await request.json() as object) };
        return HttpResponse.json(stored);
      }),
    );
    renderWithProviders(
      <Routes>
        <Route path="/projects/*" element={<ProjectsPage />} />
      </Routes>,
      { route: "/projects/p1" },
    );
    await screen.findByRole("heading", { name: "Летний запуск" });

    fireEvent.contextMenu(screen.getAllByText("Летний запуск").find((node) => node.tagName !== "H1")!);
    await user.click(await screen.findByRole("menuitemradio", { name: "Очень важно" }));
    await waitFor(() => expect(reloading).toBe(true));

    expect(screen.queryByRole("heading", { name: "Летний запуск" })).toBeInTheDocument();
    expect(screen.queryAllByRole("button", { name: /Летний запуск/ })).not.toHaveLength(0);

    release();
  });
});
