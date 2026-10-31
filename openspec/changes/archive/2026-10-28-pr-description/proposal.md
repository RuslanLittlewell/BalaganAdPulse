## Why

Pull requests open with an empty or one-line description, so a reviewer has to read the
diff to learn what a change is for. Every change already states its purpose in an OpenSpec
proposal; the pull request should carry it without anyone copying it over by hand.

## What Changes

- A workflow runs on every pull request when it is opened, reopened or pushed to, and writes a
  generated section into its description: the Why and What Changes of each OpenSpec change the
  pull request adds or edits, the parts of the project it touches, and its commits.
- The section sits between two markers and is replaced on every run; whatever the author writes
  outside it is kept.
- A pull request with no OpenSpec change says so, and still lists what it touches and its
  commits.

## Capabilities

### New Capabilities

### Modified Capabilities

No product behaviour changes; this is repository tooling, so the change sets `skip_specs`.

## Impact

- New `scripts/pr-description.mjs` with its `node:test` tests, and a root `test:scripts` script
  run by CI.
- New workflow `.github/workflows/pr-description.yml`, which needs `pull-requests: write`.
