## 1. Spacing

- [x] 1.1 Set `--spacing` to `0.25rem` and run the codemod over `apps/web/src`, including the vendored components and the calendar cell
- [x] 1.2 Move the remaining one-off pixel values onto the scale, and text under 11px to the smallest type step
- [x] 1.3 Give the CRM add column a fixed height instead of the board's full height

## 2. Color

- [x] 2.1 Make the date picker solid; drop the shell's heavy shadow and keep its glass for the tables' sticky column
- [x] 2.2 Drop the glow and the growing plus from the add tiles
- [x] 2.3 Drop the stripe from lead cards, keep it on task cards, and quiet the priority badge

## 3. Type

- [x] 3.1 Sentence case at normal tracking for the uppercase labels
- [x] 3.2 Weight 600 for headings and the logo

## 4. Motion

- [x] 4.1 Replace `transition-all` and hover scaling with named transitions

## 5. Check

- [x] 5.1 Render the dashboard, a project, the task board, the task form and CRM in both themes and at phone width; measure the grid again and fix what the render shows
- [x] 5.2 Run the web tests and the type-check until green; `openspec validate unslop-polish --strict`
