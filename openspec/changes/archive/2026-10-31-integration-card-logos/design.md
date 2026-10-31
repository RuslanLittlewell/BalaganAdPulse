## Context

The provider logos were added to the Meta integration feature for the provider window. The
Google panel lives in its own feature, which the Meta feature already imports.

## Goals / Non-Goals

**Goals:**
- Logo and product name on the Meta and Google panels.

**Non-Goals:**
- Panels for providers that cannot be connected yet.

## Decisions

- **Move `ProviderLogo` to `shared/ui`.** Importing it from the Meta feature into the Google one
  would make the two features import each other.
- **"Facebook Ads" replaces "Meta · Facebook Ads"**, the logo standing for Meta; the region keeps
  the product's name as its accessible name.

## Risks / Trade-offs

- [The provider name is no longer read out] → "Facebook Ads" and "Google Ads" name the provider
  on their own.
