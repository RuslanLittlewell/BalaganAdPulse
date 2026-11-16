## Why

The landing shows the six modules as tabs inside a rounded glass box, so a visitor sees one module
only if they click for it, and every section sits in the same kind of box. The modules should
unfold as the visitor scrolls, the way a product tour does, and each section should own the
screen instead of floating in a card.

## What Changes

- Every section of the home page takes at least the full height of the screen and sits on the
  page background, without the rounded glass box around it. Cards inside a section stay.
- The modules section becomes a scroll-driven deck: the screen holds still while the visitor
  scrolls, the six module imitations start fanned out in depth, then come forward one at a time,
  tilted in 3D, with the module's description beside them. A row of module names below shows the
  progress and jumps to a module when chosen.
- The deck replaces the module tabs. On narrow screens, for reduced motion and without scripts,
  the modules are listed one after another with their imitations.

## Capabilities

### New Capabilities

### Modified Capabilities
- `public-landing`: full-screen sections without boxes, and the modules shown as a scroll-driven
  deck.

## Impact

- `apps/landing`: the home page sections, the modules component and a new deck script; the
  module tabs script is no longer used by the modules.
