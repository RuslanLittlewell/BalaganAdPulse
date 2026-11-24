## 1. Shared filter

- [x] 1.1 Add `liveOrganizationFilter` to `#shared/infrastructure`
- [x] 1.2 Test it against `isTrialExpired` over every tariff, a null end, a past end and a future end

## 2. Claim queries

- [x] 2.1 Apply the filter in the ad metrics import and the Meta lead poll claims
- [x] 2.2 Apply the filter in the Search Console import, Analytics traffic import and page check claims
- [x] 2.3 Test each claim: expired trial skipped, running trial claimed, paid tariff claimed, another organization unaffected, schedule untouched, claimable again after a tariff is assigned

## 3. Web

- [x] 3.1 Add the sentence about paused updates to the read-only notice in `ru.ts` and `en.ts`
- [x] 3.2 Test that the notice shows it for an administrator of an expired trial

## 4. Countdown position

- [x] 4.1 Render the left area of `AppHeader` on every page, empty outside CRM
- [x] 4.2 Test that the countdown and the ended notice render outside CRM and sit after the left area in document order

## 5. Trial toast

- [x] 5.1 Publish `onTrialEnded` from `http.ts` for a 403 with the `TRIAL_ENDED` code
- [x] 5.2 Add the listener component to `tariff-status`, mount it once under the alerts provider, and add the toast copy to `ru.ts` and `en.ts`
- [x] 5.3 Drop an error toast raised within a second after a trial toast, in the alerts provider
- [x] 5.4 Test the toast for a task move, a project rename and a lead edit, one toast for several refusals, no generic twin, and no toast for a role or limit refusal

## 6. Verify

- [x] 6.1 Run `npm test` and the web suite
