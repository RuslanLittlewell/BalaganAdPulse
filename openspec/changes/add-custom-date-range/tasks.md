## 1. Range state

- [x] 1.1 Write and observe failing tests for valid `from`/`to` URL restoration, the 30-day fallback, malformed dates and reversed ranges.
- [x] 1.2 Replace preset state with an inclusive custom range that commits only valid pairs and keeps the last valid range during incomplete input.
- [x] 1.3 Run `npm test` and `npm run test:web` to green.

## 2. Date inputs

- [x] 2.1 Write and observe failing interaction tests for two labelled inputs, direct entry, both Russian calendars, validation feedback and metrics refetching with the chosen dates.
- [x] 2.2 Replace the preset buttons with two compact inputs using the existing shadcn/ui DatePicker and add all visible copy to Russian localization.
- [x] 2.3 Verify dashboard, project and campaign pages share and preserve the selected range through navigation.
- [x] 2.4 Run API/frontend builds, `openspec validate add-custom-date-range --strict`, `npm test` and `npm run test:web` to green.
