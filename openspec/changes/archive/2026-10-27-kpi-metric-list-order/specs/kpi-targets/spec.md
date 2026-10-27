## ADDED Requirements

### Requirement: The KPI dialogs list their metrics in order

The metric list of a KPI dialog SHALL give every entry a label no other entry carries and SHALL
list the entries in alphabetical order of their labels, Russian labels before Latin ones. In the
project's dialog «Вручную» SHALL come last.

#### Scenario: Leads of two kinds
- **WHEN** a project has a campaign that optimises for leads and a manager opens its KPI dialog
- **THEN** the list offers «Лиды» and «Результаты - Лиды» as two entries

#### Scenario: The order
- **WHEN** a manager opens the metric list of a project's KPI dialog
- **THEN** «Выручка» comes before «Расход», «Расход» before «CPC», and «Вручную» is the last entry
