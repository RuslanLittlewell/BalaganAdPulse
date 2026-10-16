## Why

Media buyers check yesterday's figures every morning, and reaching them takes typing the
same date into both inputs. The period control offers shortcuts for the last seven days and
for whole months, but not for the day just finished.

## What Changes

- The period control gains a Вчера shortcut, first among the shortcuts, that sets the range
  to yesterday alone.
- The shortcuts sit side by side with no gap between them; their own padding alone
  separates them.

## Capabilities

### New Capabilities

### Modified Capabilities
- `campaign-metrics`: the shortcuts include yesterday.

## Impact

- `apps/web/src/features/period/model/period.ts`, `apps/web/src/shared/config/ru.ts`.
- No API change.
