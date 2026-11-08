## Context

See proposal.md. Node 26 rejects jsdom AbortSignal objects in Request. The installed Vitest 2 jsdom environment replaces the native cancellation globals. Newer Vitest environments preserve native signals and adapt DOM listeners, but upgrading the web toolchain would broaden this repair.

## Goals / Non-Goals

Make cancellation compatible with native requests and jsdom listeners under the existing test dependencies. Preserve application cancellation and assertions. Keep production code and timeout settings unchanged.

## Decisions

Wrap the existing jsdom environment and capture Node's AbortController and AbortSignal before setup. Restore those constructors after jsdom initialization. Translate native signals to jsdom signals only for DOM addEventListener options, including already-aborted signals. Reuse one translated controller per native signal and restore the original listener method during teardown.

Validate the environment through native Request construction and fetch cancellation with MSW, DOM listener cleanup, and the reported FirstClientHint test. Run the full suites under Node 26.

## Risks / Trade-offs

Mixing native and DOM cancellation can hide regressions if either boundary loses abort state. Cover cancellation before and after listener registration and verify rejected fetches. The environment wrapper is test tooling and can be removed with a future Vitest upgrade that supplies equivalent compatibility.

## Migration Plan

No schema or deployment migration is required. Reverting the test environment file and configuration restores the previous runner behavior.
