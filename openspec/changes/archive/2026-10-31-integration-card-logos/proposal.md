## Why

A connected integration's panel is titled by text alone, "Meta · Facebook Ads" or "Google Ads",
while the window that adds one now shows each provider's logo. The panels should be recognised
the same way, by the logo next to the product's name.

## What Changes

- A Meta connection's panel is titled by the Meta logo and "Facebook Ads".
- A Google connection's panel is titled by the Google Ads logo and "Google Ads".
- The provider logos move to the shared UI, since both integrations use them.

## Capabilities

### New Capabilities

### Modified Capabilities
- `meta-project-integration`: connection panels are titled by the provider's logo and the
  product's name.

## Impact

- `apps/web/src/shared/ui`: the provider logo, moved from the Meta integration feature.
- `apps/web/src/features/meta-integration`, `apps/web/src/features/google-integration`: panel
  titles.
