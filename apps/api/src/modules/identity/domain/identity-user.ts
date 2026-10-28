export interface IdentityUser {
  readonly id: string;
  readonly name: string;
  readonly email: string | null;
  readonly login: string | null;
  readonly passwordHash: string;
  readonly image: string | null;
  readonly avatarPath: string | null;
  readonly phone: string | null;
  readonly telegram: string | null;
  readonly isPlatformAdmin: boolean;
}

export interface SessionPrincipal {
  readonly id: string;
  readonly name: string;
  readonly email: string | null;
}

export function principalOf(user: IdentityUser): SessionPrincipal {
  return { id: user.id, name: user.name, email: user.email };
}
