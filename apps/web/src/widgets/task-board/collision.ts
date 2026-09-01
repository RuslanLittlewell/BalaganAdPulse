import { closestCorners, pointerWithin, type CollisionDetection } from "@dnd-kit/core";

export const boardCollisionDetection: CollisionDetection = (args) => {
  const underPointer = pointerWithin(args);
  return underPointer.length > 0 ? underPointer : closestCorners(args);
};
