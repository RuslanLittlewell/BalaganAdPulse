## 1. Web

- [x] 1.1 Add the `emptyMeansAll` option to the shared multi-select
- [x] 1.2 Scope the CRM view to `campaignIds` read from repeated `campaign` parameters, for campaigns of any status
- [x] 1.3 Replace the campaign select in the CRM menu column with a multi-select of all the project's campaigns, running first and marked by status, and carry the choice into the section links
- [x] 1.4 Cover choosing several campaigns, stopped campaigns, the all option and the address with tests

## 2. Close

- [x] 2.1 Run the web tests and the type-check until green; `openspec validate crm-campaign-multi-select --strict`
