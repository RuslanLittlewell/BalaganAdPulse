## 1. Swipe Toast alerts

- [x] 1.1 Rewrite `test/shared/ui/Alerts.test.tsx` for the new surface: an error as an alert
  outside its raiser, a success as a status, stacking, dismissal by the close control and by
  Escape, leaving when the fuse finishes; stub `Element.prototype.animate` in the test setup. Run
  and see it fail.
- [x] 1.2 Vendor Swipe Toast with the two edits, rebuild `AlertsProvider` on it, remove
  react-toastify from `package.json` and `tokens.css`, update the profile test's success lookup.
- [x] 1.3 Run `npm run test:web` and the web build until green;
  `openspec validate swipe-toast-alerts --strict`.
