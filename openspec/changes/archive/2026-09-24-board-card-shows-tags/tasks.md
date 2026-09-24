## 1. Tags on the board card

- [x] 1.1 Update the board card and CRM page tests: the card shows its tags and no source or
  campaign; a lead without tags shows no tag row. Run them and see them fail.
- [x] 1.2 Replace the source label in `widgets/crm-board/LeadCard.tsx` with the tags, and drop the
  unused `crm.noSource` string.
- [x] 1.3 Run `npm run test:web` and `npm run build -w @adpulse/web` until green, then
  `openspec validate board-card-shows-tags --strict`.
