export interface ProjectRecord {
  readonly id: string;
  readonly clientId: string;
  readonly name: string;
  readonly budgetCurrency: string | null;
  readonly image: string | null;
  readonly avatarPath: string | null;
  readonly position: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface ProjectChange {
  readonly clientId?: string;
  readonly name?: string;
}

export interface NewProject extends ProjectChange {
  readonly clientId: string;
  readonly name: string;
  readonly memberIds?: readonly string[];
}
