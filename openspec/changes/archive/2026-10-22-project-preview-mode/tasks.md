## 1. Web

- [x] 1.1 Add a shared preview-mode hook on the `preview` search parameter.
- [x] 1.2 Hide the sidebar and header in the app shell and offer «Выйти из превью»; hide the project list on the projects page.
- [x] 1.3 Add «Превью» to the project's metrics heading; in preview show only the metrics, read-only.

## 2. Verification

- [x] 2.1 Cover entering, the hidden parts, the read-only tiles, keeping the mode across a campaign, and leaving.
- [x] 2.2 Run `npm run test:web` until green; `openspec validate project-preview-mode --strict`.
