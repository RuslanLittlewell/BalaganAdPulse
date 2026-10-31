## ADDED Requirements

### Requirement: Providers are shown as tiles with their logos
The window that adds an integration SHALL show each provider as a square tile holding the
provider's logo above its name, laid out in a grid. Meta SHALL carry the Meta logo, Google the
Google Ads logo, TikTok the TikTok logo; Yandex SHALL carry a Я mark and GPT a neutral icon
until official marks are added. A tile's accessible name SHALL be the provider's name, the
logo SHALL be hidden from assistive technology, and a provider not yet available SHALL keep
its tile, disabled and marked Скоро. Logos SHALL be part of the application, so opening the
window makes no request to another host.

#### Scenario: Recognising a provider
- **WHEN** an authorized member opens the window for adding an integration
- **THEN** Meta, Google, Yandex, TikTok and GPT appear as square tiles, each with its logo above its name

#### Scenario: A provider not yet available
- **WHEN** the window is open
- **THEN** the TikTok tile shows its logo, says Скоро and cannot be chosen
