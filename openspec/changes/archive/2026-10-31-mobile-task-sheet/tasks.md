## 1. Building blocks

- [x] 1.1 Add `useNarrowScreen` to `shared/lib`
- [x] 1.2 Add `PHONE_SHEET_CLASS_NAME` to `shared/ui`

## 2. Task dialog

- [x] 2.1 Make the dialog a full-screen sheet below `md`, scrolled through its form
- [x] 2.2 Render the close control, the title and the save button as the top bar on a phone, without the corner close and the footer's cancel and save
- [x] 2.3 Move the stage and priority after the title field on a phone as label/value rows
- [x] 2.4 Put the parameter column before the description below `md` and drop the inner scroll
- [x] 2.5 Keep only client sharing and delete in the footer on a phone, and leave it out when it holds neither

## 3. Preview

- [x] 3.1 Open the read-only preview full screen below `md`, without its footer close

## 4. Tests

- [x] 4.1 Cover the phone composition: one save and close in the top bar, saving and closing from it, the stage and priority after the title, the read-only bar
