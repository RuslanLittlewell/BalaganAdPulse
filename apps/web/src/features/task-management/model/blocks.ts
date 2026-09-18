export const TASK_BLOCKS = ["checklist", "dates", "assign"] as const;

export type TaskBlock = (typeof TASK_BLOCKS)[number];

export interface BlockValues {
  checklistLength: number;
  dueDate: string | null;
  projectId: string;
  campaignId: string;
  assigneeId: string;
}

export interface BlockPlaceholders {
  noProject: string;
  wholeProject: string;
  unassigned: string;
}

export function filledBlocks(values: BlockValues, empty: BlockPlaceholders): TaskBlock[] {
  return TASK_BLOCKS.filter((block) => {
    if (block === "checklist") return values.checklistLength > 0;
    if (block === "dates") return values.dueDate !== null;
    return values.projectId !== empty.noProject
      || values.campaignId !== empty.wholeProject
      || values.assigneeId !== empty.unassigned;
  });
}

export function shownBlocks(
  opened: ReadonlySet<TaskBlock>,
  filled: readonly TaskBlock[],
): TaskBlock[] {
  return TASK_BLOCKS.filter((block) => opened.has(block) || filled.includes(block));
}

export function offeredBlocks(shown: readonly TaskBlock[]): TaskBlock[] {
  return TASK_BLOCKS.filter((block) => !shown.includes(block));
}
