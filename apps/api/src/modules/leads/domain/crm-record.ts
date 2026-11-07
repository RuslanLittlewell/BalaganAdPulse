export const RECORD_NAME_LIMIT = 200;
export const RECORD_PHONE_LIMIT = 50;
export const RECORD_EMAIL_LIMIT = 254;
export const RECORD_HANDLE_LIMIT = 100;
export const RECORD_WEBSITE_LIMIT = 2048;
export const RECORD_NOTES_LIMIT = 10000;

export interface CompanyFields {
  name: string;
  website?: string | null;
  phone?: string | null;
  notes?: string | null;
}

export interface PersonFields {
  name: string;
  phone?: string | null;
  email?: string | null;
  telegram?: string | null;
  messenger?: string | null;
  companyId?: string | null;
  notes?: string | null;
}

export interface CompanyRecord {
  id: string;
  orgId: string;
  clientId: string;
  name: string;
  website: string | null;
  phone: string | null;
  notes: string | null;
  peopleCount: number;
  leadCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface PersonRecord {
  id: string;
  orgId: string;
  clientId: string;
  name: string;
  phone: string | null;
  email: string | null;
  telegram: string | null;
  messenger: string | null;
  companyId: string | null;
  company: { id: string; name: string } | null;
  notes: string | null;
  leadCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface PersonSummary {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  telegram: string | null;
  messenger: string | null;
}

export interface CompanySummary {
  id: string;
  name: string;
  website: string | null;
}

export interface RelatedLead {
  id: string;
  name: string;
  board: { key: string; label: string };
  stage: { id: string; name: string; color: string };
}

export interface ContactPatch {
  phone?: string | null;
  email?: string | null;
  telegram?: string | null;
  messenger?: string | null;
}

export interface OrganizationPatch {
  website?: string | null;
}

export function phoneDigitsOf(phone: string | null | undefined): string | null {
  const digits = (phone ?? "").replace(/\D/g, "");
  return digits === "" ? null : digits;
}

export function hasValues(patch: object | undefined): boolean {
  return patch !== undefined && Object.values(patch).some((value) => value !== undefined);
}
