## Why

Alerts use react-toastify's stock look, which sits apart from the rest of the interface: the
segmented control and module transitions already come from reactbits.dev. Its Swipe Toast gives
alerts the same motion language — rising in, swiped away, with a fuse that shows how long they
stay.

## What Changes

- Alerts raised through `useAlerts().raise` render with reactbits.dev's Swipe Toast in the
  bottom-right corner instead of react-toastify in the top-right.
- Several alerts stack; each can be swiped down, closed with its close control or Escape, and
  leaves by itself after 8 seconds, pausing while hovered or focused.
- An error is announced as an alert, a success as a status.
- react-toastify is removed.

## Capabilities

### New Capabilities
- `alerts`: how the application shows alerts raised outside the control that caused them.

## Impact

- **Web** (`apps/web`): `shared/ui/Alerts`, a vendored `shared/ui/SwipeToast`, the test setup
  (jsdom has no Web Animations API), `tokens.css`, `package.json`. Callers of `raise` are
  unchanged; the one test that read a success as an alert reads it as a status.
