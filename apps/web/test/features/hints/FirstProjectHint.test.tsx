import { http, HttpResponse } from "msw";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import type { Role } from "@adpulse/access-policy";
import { aProject, aSession, renderWithProviders, server } from "@test/shared/index.js";
import { useHintMemory } from "@/features/hints/index.js";
import { ProjectList } from "@/widgets/project-list/ProjectList.js";

const HINT = "Создайте проект";

function openList({ projects = [] as unknown[], role = "ADMIN" as Role } = {}) {
  server.use(
    http.get("/api/auth/me", () => HttpResponse.json(aSession({ role }))),
    http.get("/api/projects", () => HttpResponse.json(projects)),
  );
  renderWithProviders(<Routes><Route path="*" element={<ProjectList />} /></Routes>, { route: "/projects" });
}

async function settled() {
  await screen.findByText("Проектов пока нет");
  await new Promise((resolve) => setTimeout(resolve, 50));
}

describe("the add-project hint", () => {
  it("points at the add button of an empty list", async () => {
    openList();

    const hint = (await screen.findByText(HINT)).closest("[role='status']") as HTMLElement;
    expect(within(hint).getByRole("button", { name: "Закрыть подсказку" })).toBeInTheDocument();
  });

  it("is not shown once there is a project", async () => {
    openList({ projects: [aProject()] });

    await screen.findByText("Летний запуск");
    expect(screen.queryByText(HINT)).not.toBeInTheDocument();
  });

  it("is not shown to someone who may not create projects", async () => {
    openList({ role: "GUEST" });

    await settled();
    expect(screen.queryByText(HINT)).not.toBeInTheDocument();
  });

  it("hides while a project is being created", async () => {
    openList();
    await screen.findByText(HINT);

    await userEvent.click(screen.getByRole("button", { name: "Новый проект" }));

    await waitFor(() => expect(screen.queryByText(HINT)).not.toBeInTheDocument());
  });

  it("stays closed on its own once closed", async () => {
    useHintMemory.setState({ dismissed: { "user-1": ["contacts.firstClient"] } });
    openList();
    await screen.findByText(HINT);

    await userEvent.click(screen.getByRole("button", { name: "Закрыть подсказку" }));

    await waitFor(() => expect(screen.queryByText(HINT)).not.toBeInTheDocument());
    expect(useHintMemory.getState().dismissed)
      .toEqual({ "user-1": ["contacts.firstClient", "projects.firstProject"] });
  });
});
