export interface ClientRecord {
  readonly id: string;
  readonly orgId: string;
  readonly name: string;
  readonly fullName: string | null;
  readonly organization: string | null;
  readonly unp: string | null;
  readonly phone: string | null;
  readonly telegram: string | null;
  readonly email: string | null;
  readonly website: string | null;
  readonly image: string | null;
  readonly avatarPath: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface ClientContact {
  readonly name?: string;
  readonly fullName?: string | null;
  readonly organization?: string | null;
  readonly unp?: string | null;
  readonly phone?: string | null;
  readonly telegram?: string | null;
  readonly email?: string | null;
  readonly website?: string | null;
}

export interface NewClient extends ClientContact {
  readonly name: string;
}
