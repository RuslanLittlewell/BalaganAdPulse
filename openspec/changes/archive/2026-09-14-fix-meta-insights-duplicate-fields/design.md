## Context

Meta error 2500 identifies duplicate campaign_id fields in the campaign-level Insights request. The shared request builder prepends the level identifier and then unconditionally includes campaign_id.

## Goals / Non-Goals

Restore successful imports under the existing contract. Do not change metric semantics, credentials, database schema or public API.

## Decisions

Construct the requested fields as an ordered set before joining them. This retains campaign_id for adset/ad levels while emitting it once at campaign level. The regression provider fixture rejects repeated fields exactly as Meta does.

## Risks / Trade-offs

Other provider response errors can surface after this first failure is removed. Verify the complete live snapshot and import, rather than considering the first successful endpoint sufficient.
