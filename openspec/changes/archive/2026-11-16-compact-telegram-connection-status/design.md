## Context

The connected state currently renders a status word, username and usage instructions.

## Goals / Non-Goals

Show only a green indicator and the available username visually. Keep the existing Telegram actions.

## Decisions

Use a Tailwind-styled green dot and a truncated username inside a status element. Keep the localized connected word in screen-reader-only text. If no username is available, retain the indicator and accessible status without inventing a name.

## Risks / Trade-offs

Color alone cannot communicate status to screen readers; the hidden status text preserves that information.
