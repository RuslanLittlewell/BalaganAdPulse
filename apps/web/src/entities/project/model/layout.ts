export interface LayoutProjectItem {
  type: "project";
  projectId: string;
}

export interface LayoutGroupItem {
  type: "group";
  groupId: string;
  name: string;
  projectIds: string[];
}

export type LayoutItem = LayoutProjectItem | LayoutGroupItem;

export interface ProjectLayout {
  pinned: string[];
  items: LayoutItem[];
}

export interface ProjectGroup {
  id: string;
  name: string;
  position: number;
}

export type ArrangementItem =
  | { type: "project"; projectId: string }
  | { type: "group"; groupId: string; projectIds: string[] };

export interface Arrangement {
  pinned: string[];
  items: ArrangementItem[];
}

export const EMPTY_LAYOUT: ProjectLayout = { pinned: [], items: [] };

export const LIST_END = "list-end";

export const dragId = {
  project: (projectId: string) => `project:${projectId}`,
  group: (groupId: string) => `group:${groupId}`,
};

type DragTarget = { kind: "project" | "group" | "end"; id: string };

export function parseDragId(id: string): DragTarget | null {
  if (id === LIST_END) return { kind: "end", id: LIST_END };
  const [kind, ...rest] = id.split(":");
  if (kind !== "project" && kind !== "group") return null;
  return { kind, id: rest.join(":") };
}

const groups = (layout: ProjectLayout) =>
  layout.items.filter((item): item is LayoutGroupItem => item.type === "group");

export function projectIdsOf(layout: ProjectLayout): string[] {
  return [
    ...layout.pinned,
    ...layout.items.flatMap((item) => item.type === "project" ? [item.projectId] : item.projectIds),
  ];
}

export function arrangeProjects(layout: ProjectLayout, projectIds: string[]): ProjectLayout {
  const known = new Set(projectIds);
  const placed = new Set(projectIdsOf(layout).filter((id) => known.has(id)));
  return {
    pinned: layout.pinned.filter((id) => known.has(id)),
    items: [
      ...layout.items.flatMap((item): LayoutItem[] => {
        if (item.type === "group") {
          return [{ ...item, projectIds: item.projectIds.filter((id) => known.has(id)) }];
        }
        return known.has(item.projectId) ? [item] : [];
      }),
      ...projectIds.filter((id) => !placed.has(id))
        .map((projectId) => ({ type: "project", projectId }) as LayoutItem),
    ],
  };
}

function withoutProject(layout: ProjectLayout, projectId: string): ProjectLayout {
  return {
    pinned: layout.pinned.filter((id) => id !== projectId),
    items: layout.items.flatMap((item): LayoutItem[] => {
      if (item.type === "group") {
        return [{ ...item, projectIds: item.projectIds.filter((id) => id !== projectId) }];
      }
      return item.projectId === projectId ? [] : [item];
    }),
  };
}

function insertIntoGroup(
  layout: ProjectLayout,
  groupId: string,
  projectId: string,
  index: number,
): ProjectLayout {
  return {
    ...layout,
    items: layout.items.map((item) => {
      if (item.type !== "group" || item.groupId !== groupId) return item;
      const held = [...item.projectIds];
      held.splice(index, 0, projectId);
      return { ...item, projectIds: held };
    }),
  };
}

function insertAtTop(layout: ProjectLayout, item: LayoutItem, index: number): ProjectLayout {
  const items = [...layout.items];
  items.splice(index, 0, item);
  return { ...layout, items };
}

function holderOf(layout: ProjectLayout, projectId: string): LayoutGroupItem | null {
  return groups(layout).find((group) => group.projectIds.includes(projectId)) ?? null;
}

function topIndexOf(layout: ProjectLayout, projectId: string): number {
  return layout.items.findIndex(
    (item) => item.type === "project" && item.projectId === projectId,
  );
}

function containerOf(layout: ProjectLayout, projectId: string): string {
  return holderOf(layout, projectId)?.groupId ?? "top";
}

function indexIn(layout: ProjectLayout, container: string, projectId: string): number {
  if (container === "top") return topIndexOf(layout, projectId);
  const group = groups(layout).find((candidate) => candidate.groupId === container);
  return group ? group.projectIds.indexOf(projectId) : -1;
}

function moveProject(
  layout: ProjectLayout,
  projectId: string,
  over: DragTarget,
): ProjectLayout {
  if (layout.pinned.includes(projectId)) return layout;
  if (!projectIdsOf(layout).includes(projectId)) return layout;
  if (over.kind === "project" && layout.pinned.includes(over.id)) return layout;

  const without = withoutProject(layout, projectId);

  if (over.kind === "end") {
    return insertAtTop(without, { type: "project", projectId }, without.items.length);
  }

  if (over.kind === "group") {
    const group = groups(without).find((candidate) => candidate.groupId === over.id);
    return group ? insertIntoGroup(without, over.id, projectId, group.projectIds.length) : layout;
  }

  const source = containerOf(layout, projectId);
  const target = containerOf(layout, over.id);
  const downward = source === target
    && indexIn(layout, source, projectId) < indexIn(layout, target, over.id);
  const index = indexIn(without, target, over.id);
  if (index < 0) return layout;
  const at = index + (downward ? 1 : 0);

  return target === "top"
    ? insertAtTop(without, { type: "project", projectId }, at)
    : insertIntoGroup(without, target, projectId, at);
}

function moveGroup(
  layout: ProjectLayout,
  groupId: string,
  over: DragTarget,
): ProjectLayout {
  if (over.kind === "project" && holderOf(layout, over.id)) return layout;
  if (over.kind === "project" && layout.pinned.includes(over.id)) return layout;

  const group = groups(layout).find((candidate) => candidate.groupId === groupId);
  if (!group) return layout;

  const rest = layout.items.filter(
    (item) => !(item.type === "group" && item.groupId === groupId),
  );
  const without = { ...layout, items: rest };

  if (over.kind === "end") return insertAtTop(without, group, rest.length);

  const at = (items: LayoutItem[]) => items.findIndex((item) => over.kind === "group"
    ? item.type === "group" && item.groupId === over.id
    : item.type === "project" && item.projectId === over.id);
  const index = at(rest);
  if (index < 0) return layout;
  const downward = at(layout.items) > layout.items.indexOf(group);

  return insertAtTop(without, group, index + (downward ? 1 : 0));
}

export function moveInLayout(
  layout: ProjectLayout,
  activeId: string,
  overId: string,
): ProjectLayout {
  if (activeId === overId) return layout;
  const active = parseDragId(activeId);
  const over = parseDragId(overId);
  if (!active || !over) return layout;
  return active.kind === "group"
    ? moveGroup(layout, active.id, over)
    : moveProject(layout, active.id, over);
}

export function pinProject(layout: ProjectLayout, projectId: string): ProjectLayout {
  if (layout.pinned.includes(projectId)) return layout;
  const without = withoutProject(layout, projectId);
  return { ...without, pinned: [...without.pinned, projectId] };
}

export function unpinProject(layout: ProjectLayout, projectId: string): ProjectLayout {
  if (!layout.pinned.includes(projectId)) return layout;
  const without = withoutProject(layout, projectId);
  return { ...without, items: [...without.items, { type: "project", projectId }] };
}

export function asArrangement(layout: ProjectLayout): Arrangement {
  return {
    pinned: layout.pinned,
    items: layout.items.map((item) => item.type === "project"
      ? { type: "project", projectId: item.projectId }
      : { type: "group", groupId: item.groupId, projectIds: item.projectIds }),
  };
}
