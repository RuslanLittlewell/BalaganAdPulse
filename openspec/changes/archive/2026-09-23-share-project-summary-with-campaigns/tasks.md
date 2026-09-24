## 1. Campaign summary follows the project page

- [x] 1.1 Write and observe failing web tests for a summary without configuration showing its tiles and no placeholder, the campaign page showing the project page's tiles with the campaign KPI and no placeholder, and an earlier campaign choice being ignored.
- [x] 1.2 Add the non-configurable summary mode, use the project page's choice on the campaign page, and drop the campaign screen from the stored choices.
- [x] 1.3 Run the web production build, then `npm test` and `npm run test:web` until both are green.

## 2. Campaign KPI tile follows the project KPI

- [x] 2.1 Write and observe a failing web test for the campaign page's KPI tile showing the project's KPI against the campaign's figures, without controls to set or change it, even for an admin.
- [x] 2.2 Bind the campaign page's KPI tile to the project KPI, read-only.
- [x] 2.3 Run the web production build, then `npm test` and `npm run test:web` until both are green.
