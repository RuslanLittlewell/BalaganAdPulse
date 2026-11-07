export { crmRecordsApi } from './api/api.js';
export type { Company, CompanyDetail, CompanyInput, Person, PersonDetail, PersonInput, RelatedLead } from './api/api.js';
export {
  crmRecordsKey, companiesKey, peopleKey, companyKey, personKey,
  useCompanies, usePeople, useCompany, usePerson,
  useCreateCompany, useUpdateCompany, useDeleteCompany,
  useCreatePerson, useUpdatePerson, useDeletePerson,
} from './api/queries.js';
