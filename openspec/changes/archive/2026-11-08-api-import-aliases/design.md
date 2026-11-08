## Context

`#shared/*` is already a Node subpath import in `apps/api/package.json`, with a `compiled`
condition the production start command selects; TypeScript resolves it with
`moduleResolution: Bundler`, and Vitest and `tsx` follow it. The architecture test parses
imports with a regular expression and only resolves relative specifiers.

## Goals / Non-Goals

**Goals:**
- No relative import climbing more than one directory in `src`.
- The architecture rules see through aliases.

**Non-Goals:**
- Rewriting test imports.
- A `#composition/*` alias: nothing outside composition imports it.

## Decisions

- **Subpath imports, not `tsconfig` paths.** They are what `#shared/*` already uses, Node
  resolves them at runtime without a build step or loader, and the `compiled` condition
  keeps development on `src` and production on `dist`. `paths` would need a rewriting step
  for the emitted JavaScript.
- **One alias per area, `#modules/<module>/…`.** It mirrors the directory tree, so an
  import says which module and layer it reaches, and the cross-module rule can still demand
  `#modules/<other>/index.js`.
- **The rule is about distance and ownership.** `./` and `../` stay for files in the same
  neighbourhood; two levels up, or any step into another module, uses the alias. Inside a
  module, `presentation/http/*` reaching `application/*` therefore reads
  `#modules/<module>/application/…`.
- **The rewrite is mechanical.** A script resolves each relative specifier against its
  file and rewrites it when the rule demands, keeping the `.js` extension; the compiler and
  the full suite verify the result.

## Risks / Trade-offs

- [A wrong rewrite points at another file] → `tsc` fails on any unresolved or mistyped
  import, and every route runs in the API suite.
- [Long specifiers inside a module] → they name the layer they reach, which is the point of
  the layer rules.
