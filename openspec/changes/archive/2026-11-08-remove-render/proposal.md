## Why

Production moved from Render to a VPS on 2026-09-04: CI deploys over SSH, and
`app.balagan.pro` resolves to the server. `render.yaml`, the README's deployment section
and a CI comment still describe Render, so they mislead whoever reads them about where
the app runs, how it deploys and where its secrets live.

## What Changes

- Delete `render.yaml`.
- Rewrite the README's deployment section for the VPS: what runs there, how the
  `Deploy to VPS` job and `deploy/deploy.sh` ship a version, backups, rollback, where
  configuration and secrets live, changing a secret and seeding the first admin there.
- Replace the README's phase line, which named Render, and the migration note tied to
  Render's pre-deploy step.
- Drop the Render rationale from the comment heading `.github/workflows/ci.yml`.
- No change to how the app is built or deployed.

## Capabilities

### New Capabilities

### Modified Capabilities

## Impact

- `render.yaml`, `README.md`, `.github/workflows/ci.yml`. The archived phase plans keep
  their Render history unchanged.
