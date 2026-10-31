## Context

Changes go through OpenSpec, and a change's `proposal.md` holds `## Why` and
`## What Changes`. A pull request either adds or edits a change under `openspec/changes/<name>/`
or archives it to `openspec/changes/archive/<date>-<name>/`.

## Goals / Non-Goals

**Goals:**
- The description explains the purpose from the proposals, accurately and for free.
- Text the author writes stays.

**Non-Goals:**
- Summarising code with a language model.
- A local git hook; commits stay as fast as they are.

## Decisions

- **Proposals are found by path in the diff** between the base and the head, counting added,
  modified and renamed files, so archiving a change in the pull request counts. A change named
  twice — still active and archived — is shown once.
- **Proposals are read from the head commit** with `git show`, not from the checked-out merge
  ref.
- **The parts touched are named from paths**: an API module, a web slice (`layer/slice`), the
  database, a package, CI, OpenSpec, docs; each once, in a fixed order.
- **Generation and merging are pure functions** in one ES module, with a small CLI around git,
  so `node:test` covers them without a repository. The workflow imports the merge function in
  `actions/github-script` and reads the pull request's body fresh before writing, so an edit
  made while the job ran is not lost.
- **Markers are HTML comments** in the description, invisible when rendered.

## Risks / Trade-offs

- [A pull request from a fork gets a read-only token] → the update step fails for it; the
  repository takes pull requests from its own branches.
- [A proposal without the expected headings] → its section is left out and the change is still
  named.
