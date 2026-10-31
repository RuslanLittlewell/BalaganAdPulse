## 1. API

- [x] 1.1 Store and return summary tiles in the order sent, dropping the catalogue sort
- [x] 1.2 Say so in the OpenAPI description

## 2. Web

- [x] 2.1 Keep the stored order in the summary and append a tile added in the dialog
- [x] 2.2 Add a shared move handle that steps a tile with the arrow keys
- [x] 2.3 Make the summary's tiles draggable, a project's KPI cards as one group, with a drag overlay
- [x] 2.4 Move a tile one place from its handle, keep the focus and announce the new place
- [x] 2.5 Offer no dragging or handle where the summary cannot be changed

## 3. Tests

- [x] 3.1 Cover the order kept by the API
- [x] 3.2 Cover the order helpers, including no back-and-forth while dragging over a group
- [x] 3.3 Cover keyboard moves, the KPI group moving as one and summaries that cannot be rearranged
