## 1. API

- [x] 1.1 Add `isCall` to the task model with a migration
- [x] 1.2 Decide `isCall` in the schedule domain and refuse a call without a time and a repetition
- [x] 1.3 Accept `isCall` on create and update, store and return it, document it in OpenAPI
- [x] 1.4 Cover the rule with domain and API tests

## 2. Web

- [x] 2.1 Carry `isCall` on the task and offer the `Созвон` switch in the schedule block of the form
- [x] 2.2 Compute the occurrences of a repeating task within a week
- [x] 2.3 Add the `Созвоны` tab drawing each call on every day it recurs, and keep calls off the board and the calendar
- [x] 2.4 Draw the current-time line across today's column
- [x] 2.5 Share the upload limits and add the paperclip to the attachments
- [x] 2.6 Cover the switch, the occurrences, the calls view, the line and the paperclip with tests
