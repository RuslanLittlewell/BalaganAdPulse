## ADDED Requirements

### Requirement: A narrow screen shows the task header's buttons as icons
Below 768 pixels of width, the task module's Telegram bot button SHALL show only its icon, with
the mark of a linked bot still shown, and the button that creates a task SHALL show only a plus.
Both SHALL keep their names for assistive technology and do what they do on a wide screen. From
768 pixels of width, both SHALL show their names.

#### Scenario: The header on a phone
- **WHEN** a member opens the task module on a screen 390 pixels wide
- **THEN** the Telegram bot button is its icon alone and the create button is a plus, and pressing the plus opens a new task

#### Scenario: The header on a wide screen
- **WHEN** a member opens the task module on a screen 1280 pixels wide
- **THEN** the Telegram bot button and the create button show their names
