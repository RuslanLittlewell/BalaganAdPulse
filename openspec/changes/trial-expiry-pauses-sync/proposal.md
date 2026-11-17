## Why

An expired trial makes an organization read-only for its members, but the background workers still pull data for it. Metrics, leads and search statistics keep arriving from Meta, Google Ads, Search Console and Analytics, and each pull costs API quota and worker time for an organization that is not paying. The trial rule should stop the workers as it stops the members.

## What Changes

- Background jobs skip organizations whose trial has ended: the ad metrics import, the Meta lead poll, the Search Console import, the Analytics traffic import and the site page check.
- A skipped integration keeps its schedule. When the platform administrator assigns a tariff, its next run falls due at once and the data catches up.
- Stored data stays readable. Nothing is deleted, and the screens show the figures as of the last run.
- The web app tells an administrator of an expired trial that data is no longer updated.
- Every page shows the trial countdown in the same place. Today the Projects header pins it to the left edge, while the CRM header centres it between its left button and the toolbar.
- Any request that fails because the trial ended raises one toast saying so, wherever the member was and whatever they tried to change.

## Capabilities

### New Capabilities

### Modified Capabilities
- `account-tariffs`: an expired trial pauses every integration import, and a tariff assigned afterwards resumes them; the countdown sits in the same place on every page; a refused write says the trial ended in a toast.

## Impact

- `apps/api`: the claim queries of five job repositories in `integrations` and `seo` gain an organization filter; one shared filter built on `isTrialExpired`.
- `apps/web`: the read-only notice names the paused updates; the app header keeps its left slot on every page so the countdown does not move; the request layer reports a refusal for an ended trial and a listener under the alerts provider raises the toast.
- No migration, no change to the tariff catalogue.
