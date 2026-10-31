## Why

On a phone the task module's header still carries two worded buttons, the Telegram bot and
"Новая задача", beside the view tabs and the filter button; the row does not fit.

## What Changes

- Below 768 px the Telegram bot button shows only its icon, the linked mark sitting on its corner.
- Below 768 px the create button shows only a plus.
- Both keep their names for assistive technology; from 768 px both are as they are.

## Capabilities

### New Capabilities

### Modified Capabilities
- `mobile-layout`: the task module's header buttons shrink to icons on a narrow screen.

## Impact

- `apps/web/src/features/telegram-bot/ui/TelegramBotButton.tsx`
- `apps/web/src/pages/tasks/TasksPage.tsx`
