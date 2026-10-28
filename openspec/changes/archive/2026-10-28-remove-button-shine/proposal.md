## Why

Users on low-end computers report the app loading the browser and lagging. Every default,
secondary, outline and destructive button carries a WebGL shine: each listens to every
pointer move on the window, measures itself, and within 250 px of the pointer opens its own
WebGL context and renders sixty frames a second. A dialog footer or a toolbar keeps several
contexts running at once, and moving the pointer away and back creates them again.

## What Changes

- Buttons lose the pointer-following shine and render as the plain base button.
- The `Specular` effect component is removed, as nothing else uses it.

## Capabilities

### New Capabilities

### Modified Capabilities

No spec describes the shine, so no requirement changes; the change sets `skip_specs`.

## Impact

- Web: `shared/ui/Button`, `shared/ui/Specular` (removed), the `shared/ui` index.
- No API, data or copy changes. Buttons keep their names, roles, variants and handlers.
