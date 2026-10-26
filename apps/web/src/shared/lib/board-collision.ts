import {
  closestCenter,
  closestCorners,
  pointerWithin,
  type Active,
  type CollisionDetection,
  type DroppableContainer,
  type Over,
} from "@dnd-kit/core";

const columnOfCard = (container: DroppableContainer): unknown =>
  (container.data.current as { sortable?: { containerId?: unknown } } | undefined)?.sortable?.containerId;

export const boardCollisionDetection: CollisionDetection = (args) => {
  const underPointer = pointerWithin(args);
  const cardUnderPointer = underPointer.find((collision) =>
    args.droppableContainers.some((container) => container.id === collision.id && columnOfCard(container) !== undefined));
  if (cardUnderPointer) return [cardUnderPointer];

  const collisions = underPointer.length > 0 ? underPointer : closestCorners(args);
  const column = collisions[0];
  if (!column) return collisions;
  const cards = args.droppableContainers.filter((container) => columnOfCard(container) === column.id);
  if (cards.length === 0) return collisions;
  const nearest = closestCenter({ ...args, droppableContainers: cards });
  return nearest.length > 0 ? nearest : collisions;
};

export interface Landing {
  readonly container: string;
  readonly index: number;
}

export function landingOf(over: Over | null): Landing | null {
  const sortable = (over?.data.current as { sortable?: { containerId?: unknown; index?: unknown } } | undefined)?.sortable;
  return sortable && typeof sortable.containerId === "string" && typeof sortable.index === "number"
    ? { container: sortable.containerId, index: sortable.index }
    : null;
}

export function droppedBelow(active: Active, over: Over): boolean {
  const dragged = active.rect.current.translated;
  return dragged != null && dragged.top + dragged.height / 2 > over.rect.top + over.rect.height / 2;
}
