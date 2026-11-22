## 1. Dependencies

- [x] 1.1 Update the patched dependencies within their ranges and move `shadcn` to the web app's development dependencies
- [x] 1.2 Check that the patched advisories are gone and that the API, web and landing suites pass

## 2. Sign-in lock

- [x] 2.1 Add the `sign_in_lock` table and migration
- [x] 2.2 Count failures and lock in the login use case, and lift the lock on password reset and on a newly issued client password
- [x] 2.3 Test the three rounds, the shared count of login and email, an unknown login, success clearing the count, reset and issued password lifting the lock, and the per-address limit
- [x] 2.4 Show the lock on the sign-in form with the recovery link, and test it

## 3. Cross-origin refusals

- [x] 3.1 Refuse cookie-authenticated writes from another origin in the authentication middleware
- [x] 3.2 Check the WebSocket origin and cap its messages at 16 KB
- [x] 3.3 Test both, including bearer requests and same-origin writes passing

## 4. Headers and documentation

- [x] 4.1 Send the full content security policy, drop `X-Powered-By`, and let the docs page allow its inline script
- [x] 4.2 Withdraw the documentation in production unless `API_DOCS=on`
- [x] 4.3 Test the headers and the docs flag, and check the built web bundle for `eval` and `new Function`

## 5. Verify

- [x] 5.1 Run `npm test`, the web suite and the landing suite
