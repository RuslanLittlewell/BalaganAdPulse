export const PROJECT_PRIORITIES = ["CRITICAL", "URGENT", "WAITING", "IDLE", "NEW"] as const;
export type ProjectPriority = (typeof PROJECT_PRIORITIES)[number];

export interface ProjectRecord {
  readonly id: string;
  readonly clientId: string;
  readonly name: string;
  readonly budgetCurrency: string | null;
  readonly priority: ProjectPriority;
  readonly image: string | null;
  readonly avatarPath: string | null;
  readonly position: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface ProjectChange {
  readonly clientId?: string;
  readonly name?: string;
  readonly priority?: ProjectPriority;
}

export interface NewProject extends ProjectChange {
  readonly clientId: string;
  readonly name: string;
  readonly memberIds?: readonly string[];
}
