import { http as mock, HttpResponse } from "msw";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Routes, Route } from "react-router-dom";
import { aProject, renderWithProviders, server } from "@test/shared/index.js";
import { ProjectList } from "@/widgets/project-list/ProjectList.js";
import type { ProjectLayout } from "@/entities/project/index.js";

function setup(route = "/") {
  return renderWithProviders(
    <Routes><Route path="*" element={<ProjectList />} /></Routes>,
    { route },
  );
}

const PROJECTS = [
  aProject({ id: "a", name: "Альфа", priority: "NEW" }),
  aProject({ id: "b", name: "Бета", priority: "CRITICAL" }),
  aProject({ id: "c", name: "Гамма", priority: "IDLE" }),
];

function api(layout: ProjectLayout, projects = PROJECTS) {
  const saved: unknown[] = [];
  const groups: unknown[] = [];
  const removed: string[] = [];
  server.use(
    mock.get("/api/projects", () => HttpResponse.json(projects)),
    mock.get("/api/project-layout", () => HttpResponse.json(layout)),
    mock.put("/api/project-layout", async ({ request }) => {
      const body = await request.json();
      saved.push(body);
      return HttpResponse.json(layout);
    }),
    mock.post("/api/project-groups", async ({ request }) => {
      const body = await request.json();
      groups.push(body);
      return HttpResponse.json({ id: "g-new", name: "Клиенты", position: 3 }, { status: 201 });
    }),
    mock.delete("/api/project-groups/:id", ({ params }) => {
      removed.push(String(params.id));
      return new HttpResponse(null, { status: 204 });
    }),
  );
  return { saved, groups, removed };
}

const order = () =>
  screen.getAllByTestId(/^project-row-/).map((row) => row.getAttribute("data-testid"));

describe("ProjectList arrangement", () => {
  it("orders the list by the stored arrangement rather than by priority", async () => {
    api({ pinned: [], items: [
      { type: "project", projectId: "c" },
      { type: "project", projectId: "a" },
      { type: "project", projectId: "b" },
    ] });
    setup();

    await screen.findByText("Гамма");
    expect(order()).toEqual(["project-row-c", "project-row-a", "project-row-b"]);
  });

  it("shows a project the arrangement does not place yet, at the end", async () => {
    api({ pinned: [], items: [{ type: "project", projectId: "c" }] });
    setup();

    await screen.findByText("Гамма");
    await waitFor(() => expect(order()).toHaveLength(3));
    expect(order()).toEqual(["project-row-c", "project-row-a", "project-row-b"]);
  });

  it("pins a project from its context menu", async () => {
    const { saved } = api({ pinned: [], items: [
      { type: "project", projectId: "a" },
      { type: "project", projectId: "b" },
    ] });
    setup();

    fireEvent.contextMenu(await screen.findByText("Бета"));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Закрепить" }));

    await waitFor(() => expect(saved).toHaveLength(1));
    expect(saved[0]).toMatchObject({
      pinned: ["b"],
      items: [{ type: "project", projectId: "a" }, { type: "project", projectId: "c" }],
    });
  });

  it("keeps pinned projects apart, above the rest and out of dragging", async () => {
    api({ pinned: ["b"], items: [{ type: "project", projectId: "a" }] });
    setup();

    const pinned = await screen.findByRole("group", { name: "Закреплённые" });
    expect(pinned).toHaveTextContent("Бета");
    expect(screen.getByTestId("project-row-b")).toHaveAttribute("data-draggable", "false");
    expect(screen.getByTestId("project-row-a")).toHaveAttribute("data-draggable", "true");
  });

  it("drags by the whole row and the whole group header, with no handle of their own", async () => {
    api({ pinned: ["c"], items: [
      { type: "group", groupId: "g1", name: "Клиенты", projectIds: ["b"] },
      { type: "project", projectId: "a" },
    ] });
    setup();

    await screen.findByText("Альфа");
    expect(screen.queryByRole("button", { name: /Переместить/ })).not.toBeInTheDocument();
    expect(screen.getByTestId("project-row-a")).toHaveAttribute("data-drag-handle", "row");
    expect(screen.getByTestId("project-row-c")).not.toHaveAttribute("data-drag-handle");
    expect(screen.getByTestId("project-group-g1-header")).toHaveAttribute("data-drag-handle", "group");
  });

  it("keeps a drop target below the last item, for the end of the list", async () => {
    api({ pinned: [], items: [{ type: "project", projectId: "a" }] });
    setup();

    await screen.findByText("Альфа");
    const end = screen.getByTestId("project-list-end");
    expect(end).toBeInTheDocument();
    expect(screen.getByTestId("project-row-a").compareDocumentPosition(end)
      & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("unpins a project from its context menu", async () => {
    const { saved } = api({ pinned: ["b"], items: [{ type: "project", projectId: "a" }] });
    setup();

    fireEvent.contextMenu(await screen.findByText("Бета"));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Открепить" }));

    await waitFor(() => expect(saved).toHaveLength(1));
    expect(saved[0]).toMatchObject({ pinned: [] });
  });

  it("creates a group from the context menu of the list itself", async () => {
    const { groups } = api({ pinned: [], items: [{ type: "project", projectId: "a" }] });
    setup();

    await screen.findByText("Альфа");
    fireEvent.contextMenu(screen.getByTestId("project-list-area"));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Создать группу" }));

    const dialog = await screen.findByRole("dialog", { name: "Новая группа" });
    await userEvent.type(screen.getByLabelText("Название группы"), "Клиенты");
    await userEvent.click(screen.getByRole("button", { name: "Создать" }));

    await waitFor(() => expect(groups).toEqual([{ name: "Клиенты" }]));
    expect(dialog).not.toBeInTheDocument();
  });

  it("offers creating a group from the empty space below the last item", async () => {
    api({ pinned: [], items: [{ type: "project", projectId: "a" }] });
    setup();

    await screen.findByText("Альфа");
    fireEvent.contextMenu(screen.getByTestId("project-list-end"));

    expect(await screen.findByRole("menuitem", { name: "Создать группу" })).toBeInTheDocument();
  });

  it("refuses to create a group without a name", async () => {
    const { groups } = api({ pinned: [], items: [] }, []);
    setup();

    fireEvent.contextMenu(await screen.findByTestId("project-list-area"));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Создать группу" }));
    await userEvent.click(await screen.findByRole("button", { name: "Создать" }));

    expect(await screen.findByText("Введите название группы")).toBeInTheDocument();
    expect(groups).toEqual([]);
  });

  it("draws a group with its name and the projects it holds", async () => {
    api({ pinned: [], items: [
      { type: "group", groupId: "g1", name: "Клиенты", projectIds: ["b"] },
      { type: "project", projectId: "a" },
    ] });
    setup();

    const group = await screen.findByRole("group", { name: "Клиенты" });
    expect(group).toHaveTextContent("Клиенты");
    expect(group).toHaveTextContent("Бета");
    expect(group).not.toHaveTextContent("Альфа");
  });

  it("deletes an empty group from its context menu", async () => {
    const { removed } = api({ pinned: [], items: [
      { type: "group", groupId: "g1", name: "Пустая", projectIds: [] },
    ] });
    setup();

    fireEvent.contextMenu(await screen.findByText("Пустая"));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Удалить группу" }));

    await waitFor(() => expect(removed).toEqual(["g1"]));
  });

  it("keeps a group that still holds a project, explaining why", async () => {
    const { removed } = api({ pinned: [], items: [
      { type: "group", groupId: "g1", name: "Клиенты", projectIds: ["b"] },
    ] });
    setup();

    fireEvent.contextMenu(await screen.findByText("Клиенты"));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Удалить группу" }));

    expect(await screen.findByRole("alert"))
      .toHaveTextContent("Сначала уберите из группы все проекты");
    expect(removed).toEqual([]);
    expect(screen.getByRole("group", { name: "Клиенты" })).toBeInTheDocument();
  });
});
