import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { crmRecordsApi, type CompanyInput, type PersonInput } from './api.js';

export const crmRecordsKey = (clientId: string) => ['crm', 'records', clientId] as const;
export const companiesKey = (clientId: string) => [...crmRecordsKey(clientId), 'companies'] as const;
export const peopleKey = (clientId: string) => [...crmRecordsKey(clientId), 'people'] as const;
export const companyKey = (clientId: string, id: string) => [...companiesKey(clientId), id] as const;
export const personKey = (clientId: string, id: string) => [...peopleKey(clientId), id] as const;

export function useCompanies(clientId: string | undefined) {
  return useQuery({ queryKey: companiesKey(clientId ?? ''), queryFn: ({ signal }) => crmRecordsApi.companies(clientId!, signal), enabled: Boolean(clientId) });
}
export function usePeople(clientId: string | undefined) {
  return useQuery({ queryKey: peopleKey(clientId ?? ''), queryFn: ({ signal }) => crmRecordsApi.people(clientId!, signal), enabled: Boolean(clientId) });
}
export function useCompany(clientId: string | undefined, id: string | undefined) {
  return useQuery({ queryKey: companyKey(clientId ?? '', id ?? ''), queryFn: ({ signal }) => crmRecordsApi.company(clientId!, id!, signal), enabled: Boolean(clientId && id) });
}
export function usePerson(clientId: string | undefined, id: string | undefined) {
  return useQuery({ queryKey: personKey(clientId ?? '', id ?? ''), queryFn: ({ signal }) => crmRecordsApi.person(clientId!, id!, signal), enabled: Boolean(clientId && id) });
}

function useRecordMutation<T, R>(clientId: string, mutationFn: (input: T) => Promise<R>) {
  const qc = useQueryClient();
  return useMutation({ mutationFn, onSuccess: () => Promise.all([
    qc.invalidateQueries({ queryKey: crmRecordsKey(clientId) }),
    qc.invalidateQueries({ queryKey: ['crm', 'leads'] }),
  ]) });
}
export const useCreateCompany = (clientId: string) => useRecordMutation(clientId, (body: CompanyInput) => crmRecordsApi.createCompany(clientId, body));
export const useUpdateCompany = (clientId: string) => useRecordMutation(clientId, ({ id, body }: { id: string; body: CompanyInput }) => crmRecordsApi.updateCompany(clientId, id, body));
export const useDeleteCompany = (clientId: string) => useRecordMutation(clientId, (id: string) => crmRecordsApi.deleteCompany(clientId, id));
export const useCreatePerson = (clientId: string) => useRecordMutation(clientId, (body: PersonInput) => crmRecordsApi.createPerson(clientId, body));
export const useUpdatePerson = (clientId: string) => useRecordMutation(clientId, ({ id, body }: { id: string; body: PersonInput }) => crmRecordsApi.updatePerson(clientId, id, body));
export const useDeletePerson = (clientId: string) => useRecordMutation(clientId, (id: string) => crmRecordsApi.deletePerson(clientId, id));
