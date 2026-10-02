## 1. Phone from custom questions

- [x] 1.1 Add failing tests to `test/integrations/lead-answers.test.ts`: `Phone`, `tel`,
  `Contact number`, `Телефон` fill the phone; the standard answers win; Telegram and a
  non-phone answer to a `number` question fill nothing; the name falls back to a phone found this
  way. Run them and see them fail.
- [x] 1.2 Extend `mapLeadAnswers` in `meta-lead-answers.ts`; run `npm test` until green and
  `openspec validate meta-phone-from-custom-questions --strict`.
