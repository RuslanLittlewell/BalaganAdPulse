## MODIFIED Requirements

### Requirement: Form answers fill the lead's contact details
An imported lead's name SHALL be the prospect's full name answer, otherwise their first and last name answers joined, otherwise their phone, otherwise their email, otherwise the Meta lead identifier. Email and company SHALL come from the corresponding standard form answers. The phone SHALL come from the standard phone answer, otherwise the standard work phone answer, otherwise the first custom question in form order whose name mentions a phone and whose answer looks like a phone number. A question name SHALL mention a phone when, split into words at every character that is not a letter or digit and compared without regard to case, one of its words contains `phone` or `телефон`, starts with `tel` without starting with `telegram`, or is `number`. An answer SHALL look like a phone number when it holds only digits, spaces, `+`, brackets, dots and dashes, and at least five digits. An answer that is invalid or longer than the matching lead field allows SHALL be left out of that field rather than rejected or altered; the lead SHALL still be imported. Website, source text and notes SHALL start empty.

Every answer, including mapped ones, SHALL be kept on the lead in form order as question and values. At most 100 answers and 10000 characters of answer text SHALL be kept per lead; answers beyond those bounds SHALL be dropped and the lead SHALL indicate that answers were omitted. Contact values and answers SHALL NOT appear in logs, error details or realtime notifications.

#### Scenario: Standard contact form
- **WHEN** a form returns full name, phone number and email answers
- **THEN** the lead's name, phone and email hold those values and the answers list shows all three

#### Scenario: Name split in two questions
- **WHEN** a form returns only first name and last name answers
- **THEN** the lead's name is the first and last name joined by a space

#### Scenario: Invalid email answer
- **WHEN** a form returns an email answer that is not a valid address
- **THEN** the lead is imported without an email and the answer remains readable in the answers list

#### Scenario: Custom question
- **WHEN** a form asks a custom question that does not mention a phone
- **THEN** its question and answer are readable on the lead and no contact field is filled from it

#### Scenario: A custom phone question
- **WHEN** a form has no standard phone answer and asks `Phone`, `tel`, `Contact number` or `Телефон`, answered +375 (29) 123-45-67
- **THEN** the lead's phone is +375 (29) 123-45-67 and the answer stays in the answers list

#### Scenario: The standard answer wins
- **WHEN** a form returns a standard phone number answer and a custom `Phone` question
- **THEN** the lead's phone is the standard answer

#### Scenario: Not a phone
- **WHEN** a form's only phone-like questions are `Telegram` answered +375291234567 and `number_of_employees` answered 50
- **THEN** the lead is imported without a phone
