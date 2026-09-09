export interface GroupRecord {
  readonly id: string;
  readonly name: string;
  readonly position: number;
}

export interface PlacementRecord {
  readonly projectId: string;
  readonly groupId: string | null;
  readonly position: number;
  readonly pinned: boolean;
}

export interface StoredLayout {
  readonly groups: readonly GroupRecord[];
  readonly placements: readonly PlacementRecord[];
}

export interface LayoutGroup {
  readonly groupId: string;
  readonly name: string;
  readonly projectIds: readonly string[];
}

export type LayoutItem =
  | { readonly type: "project"; readonly projectId: string }
  | ({ readonly type: "group" } & LayoutGroup);

export interface ProjectLayout {
  readonly pinned: readonly string[];
  readonly items: readonly LayoutItem[];
}

export type LayoutInputItem =
  | { readonly type: "project"; readonly projectId: string }
  | { readonly type: "group"; readonly groupId: string; readonly projectIds: readonly string[] };

export interface LayoutInput {
  readonly pinned: readonly string[];
  readonly items: readonly LayoutInputItem[];
}

const byPosition = (left: { position: number }, right: { position: number }) =>
  left.position - right.position;

export function reconcile(reachableIds: readonly string[], stored: StoredLayout): ProjectLayout {
  const reachable = new Set(reachableIds);
  const placements = stored.placements.filter((placement) => reachable.has(placement.projectId));
  const groupIds = new Set(stored.groups.map((group) => group.id));
  const placed = new Set(placements.map((placement) => placement.projectId));

  const held = (groupId: string) => placements
    .filter((placement) => !placement.pinned && placement.groupId === groupId)
    .sort(byPosition)
    .map((placement) => placement.projectId);

  const loose = (placement: PlacementRecord) =>
    placement.groupId === null || !groupIds.has(placement.groupId);

  const top: Array<{ position: number; item: LayoutItem }> = [
    ...placements
      .filter((placement) => !placement.pinned && loose(placement))
      .map((placement) => ({
        position: placement.position,
        item: { type: "project", projectId: placement.projectId } as LayoutItem,
      })),
    ...stored.groups.map((group) => ({
      position: group.position,
      item: { type: "group", groupId: group.id, name: group.name, projectIds: held(group.id) } as LayoutItem,
    })),
  ].sort(byPosition);

  return {
    pinned: placements.filter((placement) => placement.pinned).sort(byPosition)
      .map((placement) => placement.projectId),
    items: [
      ...top.map((entry) => entry.item),
      ...reachableIds.filter((id) => !placed.has(id))
        .map((projectId) => ({ type: "project", projectId }) as LayoutItem),
    ],
  };
}

export function arrange(input: LayoutInput, groups: readonly GroupRecord[]): StoredLayout {
  const named = new Set(
    input.items.flatMap((item) => (item.type === "group" ? [item.groupId] : [])),
  );
  const placements: PlacementRecord[] = input.pinned.map((projectId, index) => ({
    projectId, groupId: null, position: index, pinned: true,
  }));
  const arranged: GroupRecord[] = [];

  input.items.forEach((item, index) => {
    if (item.type === "project") {
      placements.push({ projectId: item.projectId, groupId: null, position: index, pinned: false });
      return;
    }
    const group = groups.find((candidate) => candidate.id === item.groupId);
    if (!group) return;
    arranged.push({ ...group, position: index });
    item.projectIds.forEach((projectId, held) => {
      placements.push({ projectId, groupId: group.id, position: held, pinned: false });
    });
  });

  groups.filter((group) => !named.has(group.id)).forEach((group, index) => {
    arranged.push({ ...group, position: input.items.length + index });
  });

  return { groups: arranged, placements };
}

export function asInput(layout: ProjectLayout): LayoutInput {
  return {
    pinned: layout.pinned,
    items: layout.items.map((item) => item.type === "project"
      ? item
      : { type: "group", groupId: item.groupId, projectIds: item.projectIds }),
  };
}
