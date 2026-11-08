## 1. Running campaigns first or alone

- [x] 1.1 Define `isRunning` in the campaign entity and use it in `campaignTone`.
- [x] 1.2 Add `totalPerformance` to the campaign entity: sum the measured figures and derive the ratios from the sums.
- [x] 1.3 Cover `totalPerformance`: sums, ratios from sums, absent ratios on a zero divisor, an empty set.
- [x] 1.4 Add the «Только активные» switch to the project page, on per project; narrow to running campaigns while on, list running ones first while off; total the listed campaigns in the footer, account tabs included; say when no campaign is running.
- [x] 1.5 Cover the project page: running only by default, all with running first when off, the switch on again in another project, the total of the listed rows, the account tab's total, the empty message.
- [x] 1.6 Run `npm run test:web` until green; `openspec validate running-campaigns-first --strict`.
