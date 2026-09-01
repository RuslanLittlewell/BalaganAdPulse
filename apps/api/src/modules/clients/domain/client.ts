/** The agency's customer, as a CRM record. The contact-book fields are all
 * optional: a client is usable long before anyone has collected its paperwork. */
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
  /** A marker that a picture exists and when it landed, not a URL — nothing
   * fetches it. The use case swaps it for the bytes on the way out. */
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
