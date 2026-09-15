## 1. Contact book client list

- [x] 1.1 Write and observe failing web tests for Новый контакт living in the client list rather than the details header, opening the new-contact form, being absent for guests, and a client name exposing its full name on hover.
- [x] 1.2 Move the creation control to the bottom right of the client list and shorten long names with their full name as a title.
- [x] 1.3 Run `npm test` and `npm run test:web` until both are green.

## 2. Client creation from the project form

- [x] 2.1 Write and observe failing web tests for Новый клиент beside the client select opening the new-client form over the project form, the created client being selected and sent with the project, cancel keeping the previous selection, the control being absent without client creation rights, and the created client listed in the contact book.
- [x] 2.2 Wire `ClientFormDialog` into `ProjectFormDialog` beside the client select and select the created client.
- [x] 2.3 Run `npm test` and `npm run test:web` until both are green.
