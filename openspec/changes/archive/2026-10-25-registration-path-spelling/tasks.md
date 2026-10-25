## 1. API

- [x] 1.1 Mount the resolver at `/api/registration` and generate `/registration/{code}` links.

## 2. Web

- [x] 2.1 Serve the page at `/registration/:code`, redirect `/regustration/:code` to it and call the new lookup.

## 3. Verification

- [x] 3.1 Update the tests and README; cover the redirect.
- [x] 3.2 Run the tests until green; `openspec validate registration-path-spelling --strict`.
