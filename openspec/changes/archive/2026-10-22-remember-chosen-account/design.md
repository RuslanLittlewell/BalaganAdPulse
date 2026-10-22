## Decisions

- **Remembered per project, on the device.** The choice is kept in the browser's storage by
  project id, like the other view memories, so it survives leaving the page and reloading.
- **The account is identified by provider and account number**, as the tabs already are, so
  equal numbers in two systems stay apart.
- **A stale choice falls back to the first account** instead of showing an empty table.
