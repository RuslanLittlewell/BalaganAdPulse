## Why

On a phone the task dialog keeps its desktop composition: the stage and priority selects do not
fit beside the title, the description scrolls inside its own box with the dates, project and
participants pushed below it, the footer's four controls do not fit in a row, and the centred
window loses height to browser bars and the keyboard.

## What Changes

- Below 768 px a task opens as a full-screen sheet scrolled as one page.
- A bar across its top holds the control to close it, its title and the button that saves.
- The stage and the priority follow the task's title as label and value rows, then the dates,
  project and participants, then the description, checklist, attachments and comments.
- Sharing with the client and deleting close the page.
- The read-only preview of a task opens full screen as well, closed from its top corner.
- From 768 px both dialogs stay as they are.

## Capabilities

### New Capabilities

### Modified Capabilities
- `mobile-layout`: a task opens as a full-screen sheet on a narrow screen.

## Impact

- `apps/web/src/features/task-management/ui/TaskFormDialog.tsx`: the phone composition.
- `apps/web/src/features/task-management/ui/TaskPreviewDialog.tsx`: full screen on a phone.
- `apps/web/src/shared/lib/useNarrowScreen.ts`: a hook telling whether the screen is under `md`.
- `apps/web/src/shared/ui/PhoneSheet/PhoneSheet.ts`: the classes turning a dialog into a
  full-screen sheet on a phone.
