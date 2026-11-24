export const phoneKey = (value: string | null | undefined): string | null => {
  const digits = (value ?? "").replace(/\D/g, "");
  return digits === "" ? null : digits;
};

export const emailKey = (value: string | null | undefined): string | null => {
  const key = (value ?? "").trim().toLowerCase();
  return key === "" ? null : key;
};

export const nameKey = (value: string | null | undefined): string | null => {
  const key = (value ?? "").trim().toLowerCase();
  return key === "" ? null : key;
};

export const hostKey = (value: string | null | undefined): string | null => {
  const source = (value ?? "").trim();
  if (source === "") return null;
  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(source) ? source : `https://${source}`;
  if (!URL.canParse(candidate)) return null;
  const { protocol, hostname } = new URL(candidate);
  if (protocol !== "http:" && protocol !== "https:") return null;
  const host = hostname.toLowerCase().replace(/^www\./, "");
  return host === "" ? null : host;
};

interface Reachable {
  phone: string | null;
  email: string | null;
}

interface Named {
  name: string;
  website: string | null;
}

const sameKey = (left: string | null, right: string | null) => left !== null && left === right;

export const contactsMatch = (left: Reachable, right: Reachable): boolean =>
  sameKey(phoneKey(left.phone), phoneKey(right.phone)) || sameKey(emailKey(left.email), emailKey(right.email));

export const companiesMatch = (left: Named, right: Named): boolean =>
  sameKey(nameKey(left.name), nameKey(right.name)) || sameKey(hostKey(left.website), hostKey(right.website));

export const leadNamesMatch = (left: string, right: string): boolean => sameKey(nameKey(left), nameKey(right));
