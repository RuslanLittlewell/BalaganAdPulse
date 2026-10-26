## ADDED Requirements

### Requirement: Notifications reach the linked Telegram chat

Every notification created for a member who has connected the Telegram bot and keeps
notifications on SHALL also be sent to their Telegram chat. The message SHALL say what the app's
notification says, name the person who caused it when there is one, give the deadline of a task
that is due soon, and link to what the notification opens in the app: a document in its project, a
task in the task module, otherwise the project. An unread notification of a task change that is
refreshed by a later change SHALL NOT be sent again. Failing to reach Telegram SHALL NOT affect the
notification in the app or the notifications of other members.

#### Scenario: Being named on a task
- **WHEN** a manager adds a member who has connected the bot to a task
- **THEN** the member's Telegram chat receives «Вас назначили участником задачи» with the task's
  title, the manager's name and a link that opens the task

#### Scenario: A member without the bot
- **WHEN** a notification is created for a member who has not connected the bot
- **THEN** nothing is sent to Telegram and the notification appears in the app as before

#### Scenario: Another change to the same task
- **WHEN** a task the member has an unread change notice for is changed again
- **THEN** no second Telegram message is sent

#### Scenario: A blocked bot
- **WHEN** one recipient has blocked the bot and a project is created for three members
- **THEN** the other two still receive their Telegram messages and all three see the notification
  in the app

### Requirement: A member chooses whether notifications go to Telegram

The Telegram section of the profile SHALL show, for a connected bot, a switch «Присылать уведомления»
that is on by default and when the bot is connected again. Turning it off SHALL stop notifications
from being sent to Telegram without disconnecting the bot; turning it on SHALL resume them. Changing
it for a bot that is not connected SHALL be refused.

#### Scenario: Turning notifications off
- **WHEN** a member turns the switch off
- **THEN** new notifications appear only in the app and the bot still creates tasks

#### Scenario: Not connected
- **WHEN** a member without a connected bot asks to change the switch
- **THEN** the API responds 404
