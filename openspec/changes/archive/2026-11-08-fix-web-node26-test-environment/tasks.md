## 1. Node 26 web test compatibility

- [x] 1.1 Configure a jsdom environment that preserves native cancellation and adapts DOM event listeners.
- [x] 1.2 Cover Request and fetch cancellation and DOM listener cancellation, then verify FirstClientHint and session regressions on Node 26.
- [x] 1.3 Run green npm test and npm run test:web on Node 26, check the web build and strict OpenSpec validation, and archive the completed change.
