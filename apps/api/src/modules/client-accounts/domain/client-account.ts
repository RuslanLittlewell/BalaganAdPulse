const LATIN_OF: Readonly<Record<string, string>> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y",
  к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f",
  х: "kh", ц: "ts", ч: "ch", ш: "sh", щ: "shch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
  і: "i", ў: "u", є: "ye", ї: "yi", ґ: "g",
};

export const LOGIN_PREFIX_LIMIT = 20;
export const FALLBACK_LOGIN_PREFIX = "client";
export const LOGIN_DOMAIN = "balagan.pro";

export function loginPrefix(clientName: string): string {
  const latin = [...clientName.toLowerCase()].map((letter) => LATIN_OF[letter] ?? letter).join("");
  const plain = latin.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const hyphenated = plain.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return hyphenated.slice(0, LOGIN_PREFIX_LIMIT).replace(/-+$/, "") || FALLBACK_LOGIN_PREFIX;
}

export function loginOf(prefix: string, digits: string): string {
  return `${prefix}-${digits}@${LOGIN_DOMAIN}`;
}

export interface ClientAccountRecord {
  readonly userId: string;
  readonly membershipId: string;
  readonly login: string;
  readonly issuedPassword: string | null;
  readonly createdAt: Date;
}

export interface ClientCredentials {
  readonly login: string;
  readonly password: string | null;
  readonly createdAt: Date;
}
