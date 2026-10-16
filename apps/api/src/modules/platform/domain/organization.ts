import type { OptionalModule } from "@adpulse/access-policy";

export const ORGANIZATION_STATUSES = ["ACTIVE", "SUSPENDED"] as const;
export type OrganizationStatus = (typeof ORGANIZATION_STATUSES)[number];

export type FirstAdminState = "PENDING" | "ACCEPTED";

export interface FirstAdminInvitation {
  readonly email: string | null;
  readonly code: string;
  readonly usedAt: Date | null;
  readonly revokedAt: Date | null;
  readonly expiresAt: Date | null;
}

export interface OrganizationRecord {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly status: OrganizationStatus;
  readonly modules: readonly OptionalModule[];
  readonly activeMembers: number;
  readonly createdAt: Date;
  readonly firstAdminInvitation: FirstAdminInvitation | null;
}

export function firstAdminState(invitation: FirstAdminInvitation, now: Date): FirstAdminState | null {
  if (invitation.usedAt) return "ACCEPTED";
  if (invitation.revokedAt) return null;
  if (invitation.expiresAt && invitation.expiresAt.getTime() <= now.getTime()) return null;
  return "PENDING";
}

const CYRILLIC: Readonly<Record<string, string>> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y",
  к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f",
  х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

const MAX_SLUG_LENGTH = 48;
const FALLBACK_SLUG = "organization";

export function slugBase(name: string): string {
  const latin = [...name.toLowerCase()].map((letter) => CYRILLIC[letter] ?? letter).join("");
  const slug = latin
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/^-+|-+$/g, "");
  return slug || FALLBACK_SLUG;
}

export function uniqueSlug(base: string, taken: readonly string[]): string {
  if (!taken.includes(base)) return base;
  let suffix = 2;
  while (taken.includes(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}
