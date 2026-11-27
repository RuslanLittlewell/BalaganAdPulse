## ADDED Requirements

### Requirement: General holds no explanatory blocks or CRM switch

General SHALL NOT display the language reload or planned feature explanatory block, and SHALL NOT
hold a CRM by campaign switch, which is a setting of the project.

#### Scenario: Viewing General
- **WHEN** a member opens General
- **THEN** its preference controls appear without the language reload and planned feature explanations and without a CRM by campaign switch

## REMOVED Requirements

### Requirement: Members can retain a campaign CRM preference

**Reason**: CRM by campaign is a setting of the project, changed from the CRM header.

**Migration**: Turn on CRM по кампаниям beside Интеграции for each project that is worked by
campaign. The browser preference is no longer read.
