export const SHARE_TOKEN = /^[A-Za-z0-9_-]{43}$/;

export interface ShareLink {
  readonly token: string;
  readonly createdAt: Date;
}

export interface LiveShareLink {
  readonly id: string;
  readonly projectId: string;
  readonly orgId: string;
}
