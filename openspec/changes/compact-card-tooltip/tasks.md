## 1. Details tooltip

- [ ] 1.1 Add failing tests: a compact card's tooltip holds the title, time, project and assignee;
  a full-size card shows none. Run them and see them fail.
- [ ] 1.2 Wrap compact cards in the shared tooltip; run `npm run test:web`, the web build and
  `openspec validate compact-card-tooltip --strict`.
