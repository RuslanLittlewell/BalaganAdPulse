export interface IdentityUser {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly passwordHash: string;
  readonly image: string | null;
  readonly avatarPath: string | null;
  /** How to reach them. Theirs to keep current, and never required. */
  readonly phone: string | null;
  readonly telegram: string | null;
}

export interface SessionPrincipal {
  readonly id: string;
  readonly name: string;
  readonly email: string;
}

export function principalOf(user: IdentityUser): SessionPrincipal {
  return { id: user.id, name: user.name, email: user.email };
}
