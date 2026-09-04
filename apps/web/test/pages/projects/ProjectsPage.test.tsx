import { http, HttpResponse } from "msw";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { aClient, aProject, renderWithProviders, server } from "@test/shared/index.js";
import { ProjectsPage } from "@/pages/projects/ProjectsPage.js";

const acme = aClient({ id: "1", name: "Acme" });
const summer = aProject({ id: "p1", clientId: "1", name: "Летний запуск" });

function setup(route = "/projects", projects = [summer]) {
  server.use(
    http.get("/api/clients", () => HttpResponse.json([acme])),
    http.get("/api/projects", () => HttpResponse.json(projects)),
    http.get("/api/projects/p1/campaigns", () => HttpResponse.json([])),
  );
  return renderWithProviders(
    <Routes>
      <Route path="/projects/*" element={<ProjectsPage />} />
    </Routes>,
    { route },
  );
}

describe("ProjectsPage", () => {
  it("lists projects, each labelled with its client", async () => {
    setup();
    expect(await screen.findByText("Летний запуск")).toBeInTheDocument();
    expect(screen.getByText("Acme")).toBeInTheDocument();
  });

  it("offers a way to create one", async () => {
    setup();
    expect(await screen.findByRole("button", { name: /Новый проект/ })).toBeInTheDocument();
  });

  it("asks for a choice before one is made", async () => {
    setup();
    expect(await screen.findByText("Проект не выбран")).toBeInTheDocument();
    expect(screen.getByText("Выберите из списка или создайте новый")).toBeInTheDocument();
  });

  it("centres the prompt in the pane rather than parking it at the top", async () => {
    setup();
    await screen.findByText("Проект не выбран");
    const centred = screen.getByTestId("projects-unselected");

    expect(centred.className).toContain("h-full");
    expect(centred.className).toContain("items-center");
    expect(centred.className).toContain("justify-center");
  });

  it("leaves a selected project filling the pane", async () => {
    setup("/projects/p1");
    await screen.findByRole("heading", { name: "Летний запуск" });

    expect(screen.queryByTestId("projects-unselected")).not.toBeInTheDocument();
  });

  it("opens a project from the list", async () => {
    setup();
    await userEvent.click(await screen.findByText("Летний запуск"));
    expect(await screen.findByRole("heading", { name: "Летний запуск" })).toBeInTheDocument();
  });

  it("opens a project straight from the URL", async () => {
    setup("/projects/p1");
    expect(await screen.findByRole("heading", { name: "Летний запуск" })).toBeInTheDocument();
  });

  it("shows the client and the niche beside the project name", async () => {
    setup("/projects/p1", [aProject({ id: "p1", clientId: "1", name: "Летний запуск", niche: "fitness" })]);
    expect(await screen.findByText("Acme · fitness")).toBeInTheDocument();
  });
});
