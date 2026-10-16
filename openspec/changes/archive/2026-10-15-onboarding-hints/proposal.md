## Why

A newly added organization opens on an empty application, and its first administrator has
nothing pointing to where employees and clients are added. A series of onboarding hints is
planned; this change brings the mechanism and its first hint.

## What Changes

- Add onboarding hints: a bubble anchored to a control, pointing at it, that stays until the
  person closes it with its close button and does not come back once closed.
- First hint: on the header's contact book button, "Добавить сотрудников и клиентов",
  shown to an organization admin while the organization has no clients and no employees
  besides them.

## Capabilities

### New Capabilities

- `onboarding-hints`: dismissible hints anchored to controls, and the hint that points a new
  organization's admin to the contact book.

### Modified Capabilities

None.

## Impact

- Web only: a `Hint` component in `shared/ui`, a `hints` feature remembering what each
  person dismissed, the contact book button in `widgets/app-header`, copy in `ru.ts`.
- No API or schema change.
