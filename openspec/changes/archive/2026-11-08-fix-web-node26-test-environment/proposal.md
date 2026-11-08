## Why

Web tests run on Node 26 in CI. Vitest 2 replaces Node's AbortController with jsdom's implementation, which Node 26 fetch rejects. Session bootstrap then fails and otherwise valid UI tests cannot render authorized content. The previous local verification used Node 22 and missed this failure.

## What Changes

- Keep Node's cancellation constructors in the web test environment so native fetch and Request accept query and session signals.
- Adapt cancellation signals at the jsdom event-listener boundary so DOM listeners still detach on abort.
- Verify native requests, DOM cancellation, session loading and the full web suite on the repository's Node 26 runtime.

## Capabilities

No product requirement changes. This change repairs test tooling and sets skip_specs.

## Impact

The web Vitest environment, its configuration and regression tests change. Application code, dependencies and API contracts do not change. No migration is required.
