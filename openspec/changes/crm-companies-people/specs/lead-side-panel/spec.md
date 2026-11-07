## MODIFIED Requirements

### Requirement: Fields are grouped

The Поля tab SHALL show labelled rows in collapsible groups, in this order:
- Сделка: Сумма сделки, Ответственный, Метки, Услуга, Источник. The stage is chosen in the header, not repeated here.
- Контакты:
  - Контакт, which picks a person of the board's client or creates one from a typed name;
  - the contact's Номер телефона, Telegram, Мессенджер and Email;
  - Организация, which picks or creates an organization the same way;
  - the organization's Сайт.

  Editing a contact or organization value SHALL change that record, and SHALL create it named after the lead when the lead has none. The contact and the organization SHALL each offer opening their own panel.
  Choosing to create a named contact or organization from these rows SHALL open the corresponding creation side panel. After creation, the new record SHALL be linked to the lead and the lead's panel SHALL return.
- Свои поля: the board's custom fields in board order. The group is omitted when the board has none.
- Описание: the lead's notes.
- Системные: Дата поступления and Откуда, which reads Вручную or Meta. Both are read-only.

An empty value SHALL show a quiet placeholder. The panel SHALL offer no campaign choice.

#### Scenario: The groups of a board with custom fields
- **WHEN** a member opens a lead on a board with the field Бюджет
- **THEN** the Поля tab shows Сделка, Контакты, Свои поля with Бюджет, Описание and Системные, in that order

#### Scenario: Picking an existing contact
- **WHEN** a member opens Контакт on a lead and picks Анна from the client's people
- **THEN** the lead points to Анна and the contact rows show Анна's phone and email

#### Scenario: Creating an organization from the panel
- **WHEN** a member types Лютик in Организация, which no organization of the client is named, and confirms
- **THEN** the organization Лютик is created for the client and linked to the lead

### Requirement: The panel offers its tabs

The panel SHALL offer the tabs Поля, Активность and Файлы. A lead that arrived through an integration SHALL also get Информация. Поля SHALL be shown first when a lead opens. Активность, Файлы and Информация SHALL keep the content and permissions they had in the lead card.

#### Scenario: A hand-made lead
- **WHEN** a member opens a lead a member created
- **THEN** the panel offers Поля, Активность and Файлы and no Информация
