## Context

The landing is a static Astro site with Tailwind and a few vanilla scripts; it has no animation
library. Module imitations are Astro components whose inner animations run while their container
carries `data-play`, which `replay` toggles. The page must read the same without scripts.

## Goals / Non-Goals

**Goals:**
- A pinned, scroll-scrubbed 3D deck of the module imitations on wide screens.
- One document that serves the deck, the stacked list, reduced motion and no-script readers.

**Non-Goals:**
- A phone version of the deck. Narrow screens get the stacked list.
- Restyling the privacy page, which keeps its boxes.

## Decisions

- **Sticky, not a pin library.** The section is as tall as the deck's scroll distance and holds a
  `position: sticky` stage of one screen. A script reads how far the section has scrolled on each
  animation frame and writes transforms and opacity. GSAP ScrollTrigger would do the same at the
  cost of a dependency for one section.
- **One article per module, stacked in one grid cell.** Each module is an `article` holding its
  copy and its imitation. Without the deck they flow one after another. With the deck the script
  sets `data-deck` on the section, CSS stacks every article in the same cell, and the script
  fades the copy and moves the imitation. No content is duplicated for the two layouts.
- **Held chapters.** The scroll distance is split into one unit per step. Within a unit the deck
  holds still for the first part and moves for the rest, so each module can be read before the
  next arrives. The last module holds for an extra half unit before the section scrolls away.
- **Transforms.** The current imitation sits at `rotateY(-8deg) rotateX(5deg)` slightly forward;
  the next waits right and back at `rotateY(-35deg)`; the previous recedes left and back at
  `rotateY(35deg)`; both of those are transparent. The opening fan places the imitations right and
  back of each other, each further one fainter. Values between states are interpolated linearly
  from the eased step position.
- **Progress row as buttons.** Module names below the deck are buttons, not links, so the section
  still sends nobody anywhere, and they are hidden until the deck mounts.
- **Deck only where it fits.** The script mounts the deck at widths of 1024px and more when motion
  is allowed, and unmounts it when the width drops, restoring the list.

## Risks / Trade-offs

- [A short laptop screen cannot fit the copy and the imitation] → The stage leaves room for the
  header and the progress row and scales the imitation down with the screen height.
- [Screen readers meet all six descriptions at once in the deck] → Acceptable: the copy is the same
  as in the list, and none of it is interactive.
