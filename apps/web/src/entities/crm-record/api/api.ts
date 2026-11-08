import { http } from '@/shared/lib/index.js';

export interface RelatedLead {
  id: string;
  name: string;
  board: { key: string; label: string };
  stage: { id: string; name: string; color: string };
}

export interface Company {
  id: string;
  orgId: string;
  clientId: string;
  name: string;
  website: string | null;
  phone: string | null;
  notes: string | null;
  peopleCount: number;
  leadCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Person {
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
  createdAt: string;
  updatedAt: string;
}

export interface CompanyDetail extends Company { people: Person[]; leads: RelatedLead[] }
export interface PersonDetail extends Person { leads: RelatedLead[] }
export type CompanyInput = Partial<Pick<Company, 'name' | 'website' | 'phone' | 'notes'>>;
export type PersonInput = Partial<Pick<Person, 'name' | 'phone' | 'email' | 'telegram' | 'messenger' | 'companyId' | 'notes'>>;

const root = (clientId: string) => `/crm/clients/${encodeURIComponent(clientId)}`;
const record = (clientId: string, kind: 'companies' | 'people', id: string) => `${root(clientId)}/${kind}/${encodeURIComponent(id)}`;

export const crmRecordsApi = {
  companies: (clientId: string, signal?: AbortSignal) => http.get<Company[]>(`${root(clientId)}/companies`, { signal }),
  company: (clientId: string, id: string, signal?: AbortSignal) => http.get<CompanyDetail>(record(clientId, 'companies', id), { signal }),
  createCompany: (clientId: string, body: CompanyInput) => http.post<Company>(`${root(clientId)}/companies`, body),
  updateCompany: (clientId: string, id: string, body: CompanyInput) => http.patch<Company>(record(clientId, 'companies', id), body),
  deleteCompany: (clientId: string, id: string) => http.del(record(clientId, 'companies', id)),
  people: (clientId: string, signal?: AbortSignal) => http.get<Person[]>(`${root(clientId)}/people`, { signal }),
  person: (clientId: string, id: string, signal?: AbortSignal) => http.get<PersonDetail>(record(clientId, 'people', id), { signal }),
  createPerson: (clientId: string, body: PersonInput) => http.post<Person>(`${root(clientId)}/people`, body),
  updatePerson: (clientId: string, id: string, body: PersonInput) => http.patch<Person>(record(clientId, 'people', id), body),
  deletePerson: (clientId: string, id: string) => http.del(record(clientId, 'people', id)),
};
