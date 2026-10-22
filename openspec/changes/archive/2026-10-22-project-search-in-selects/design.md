## Decisions

- **One shared component for single choices, one option on the multiple select.** A searchable
  select keeps the library's select, adds a search field to the top of its list and hides the
  options that do not match, so the chosen option's text stays available to the trigger. The
  multiple select gains the same field behind a flag.
- **Typing stays in the field.** Key presses in the field do not reach the list's own
  letter-by-letter search. Arrow down moves to the first option, Enter chooses the first match,
  Escape closes the list. The search is cleared whenever the list closes.
- **Pinned options.** An option such as "All projects" is shown when there is no query and hidden
  while the member searches, so the matches are the whole list.
