## Why

The window for adding an integration lists the providers as a column of plain buttons with
their names only, so the member reads each line to find the one they want. Square tiles with
each service's logo are recognised at a glance.

## What Changes

- The provider window shows each provider as a square tile with its logo above its name.
- Providers not yet available keep their tile, disabled and marked Скоро.
- Meta, Google Ads and TikTok logos come from Simple Icons (CC0). Simple Icons carries no
  Yandex or OpenAI logo, so Yandex gets a red Я mark and GPT a neutral sparkles icon.
- Logos are drawn inline, so the window makes no request to a third-party host.

## Capabilities

### New Capabilities

### Modified Capabilities
- `meta-project-integration`: the provider window shows square tiles with each provider's
  logo.

## Impact

- `apps/web/src/features/meta-integration`: the provider window and a provider logo component.
- No API or dependency change.
