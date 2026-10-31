## Context

`TelegramBotButton` renders an icon, its label and a dot when the bot is linked. The create
button in `TasksPage` is a plain worded `Button`.

## Goals / Non-Goals

**Goals:**
- Icon-only header buttons on a phone, with their names kept.

**Non-Goals:**
- Other worded buttons on a phone.

## Decisions

- **The label becomes `sr-only` below `md`** (`sr-only md:not-sr-only`) rather than being
  removed, so each button keeps its accessible name and the existing tests that find them by name
  hold without a second, mobile-only button.
- **Square buttons of 40 px below `md`** (`max-md:size-10`), the height of the filter button
  beside them.
- **The plus is hidden from `md`**, so the wide-screen button stays text alone;
  `md:has-[>svg]:px-4` keeps its padding, which the hidden icon would otherwise narrow through the
  button's `has-[>svg]` rule.
- **The linked dot moves to the icon's corner below `md`**, since there is no text to follow.
- **No new tests.** The change is layout alone; names and behaviour are unchanged and covered.
