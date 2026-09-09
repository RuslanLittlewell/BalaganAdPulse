## Context

The same PeriodControl is rendered on dashboard, project and campaign pages. Its state currently stores one preset key in the `period` URL parameter and converts that key to a range. The shared UI already provides a Russian single-date DatePicker built from the project's shadcn/ui Calendar and Popover.

## Goals / Non-Goals

**Goals:** Provide two compact, accessible date fields; keep one range across metrics views; preserve valid selections through navigation and reload; prevent invalid ranges from reaching API queries.

**Non-Goals:** Change backend range semantics, add time selection, change Meta import windows, or introduce another calendar dependency.

## Decisions

Replace the preset model with a range model backed by `from` and `to` URL parameters. The default remains the last 30 calendar days including today. This gives shared links explicit meaning and avoids retaining an obsolete preset alongside dates.

Render two labelled text inputs with calendar buttons, each using the existing DatePicker. Keep draft strings locally while the user types. Commit both URL parameters only when both drafts are valid ISO calendar dates and `from <= to`; otherwise show inline Russian validation and retain the last valid range for queries. Calendar selection updates the relevant draft and applies immediately when the pair is valid.

Use the existing DatePicker rather than a new range-mode calendar because the requested interaction is specifically two inputs and the existing component already supplies localization, keyboard handling and accessible popovers.

## Risks / Trade-offs

- Existing links using `?period=` will fall back to the 30-day default → the removed preset parameter is UI state rather than a public API contract.
- Partial typing briefly creates an invalid draft → queries retain the last committed range until both values validate.
- Native text parsing differs by browser → accept and serialize only strict `YYYY-MM-DD` values while displaying the same unambiguous format.
