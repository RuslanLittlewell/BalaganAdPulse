## Context

`ProviderDialog` renders five full-width outline buttons. The app carries no brand marks, and
lucide, its icon set, has none.

## Goals / Non-Goals

**Goals:**
- Square tiles with recognisable logos in the provider window.

**Non-Goals:**
- Logos on the connection panels or tabs.
- Official Yandex and OpenAI marks, which Simple Icons does not carry; they can replace the
  stand-ins later.

## Decisions

- **Inline SVG paths copied from Simple Icons** rather than a hotlink to `cdn.simpleicons.org`
  or the `simple-icons` package: no third-party request at runtime, no dependency to rebuild
  the containers for, and three short paths. Simple Icons is CC0.
- **Brand colours where they read in both themes**: Meta `#0467DF`, Google Ads `#4285F4`,
  Yandex red `#FC3F1D`. TikTok's black mark uses the text colour so it shows on dark themes.
- **Tiles stay `Button`s** so focus, hover and disabled states match the rest of the app; the
  name remains the accessible name and the logo is `aria-hidden`.

## Risks / Trade-offs

- [Stand-in marks for Yandex and GPT] → both providers are disabled for now; the marks can be
  swapped when they launch.
