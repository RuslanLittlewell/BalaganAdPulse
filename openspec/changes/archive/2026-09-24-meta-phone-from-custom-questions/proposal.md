## Why

Many Instant Forms ask for the phone with a custom question — `Phone`, `tel`, `Contact number`,
`Телефон` — rather than Meta's standard `phone_number` field. Those leads arrive with the number
buried in Доп. информация and an empty Номер телефона, so staff copy it by hand.

## What Changes

- When a form has no usable standard phone answer, an imported lead's phone is taken from the
  first custom question, in form order, whose name mentions a phone — a word containing `phone`
  or `телефон`, a word starting with `tel` other than a Telegram word, or the word `number` — and
  whose answer looks like a phone number: digits with `+`, spaces, brackets, dots or dashes, and at
  least five digits.
- Standard answers keep precedence: `phone_number`, then `work_phone_number`, then custom
  questions.
- The answer stays in the answers list, as every answer does. A name falling back to the phone
  uses the phone found this way too.
- Leads imported before this change are not rewritten.

## Capabilities

### Modified Capabilities
- `meta-lead-import`: phone taken from custom phone-like questions.

## Impact

- **API** (`apps/api`): `meta-lead-answers.ts` and its test. No schema or data change.
