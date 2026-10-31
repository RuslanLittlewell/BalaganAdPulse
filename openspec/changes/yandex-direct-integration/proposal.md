## Why

Many of the agency's clients advertise in Yandex Direct, but a project can be connected only to
Meta and Google; the provider window shows Yandex as "not yet available". A media buyer wants a
project's Direct campaigns, figures and creatives beside its Meta and Google ones, kept current
without manual entry.

## What Changes

- A project can be connected to one or more Yandex Direct accounts, each as its own connection,
  by signing in with a Yandex ID on that project. Each project usually has its own Yandex login,
  or its own client under an agency login: the sign-in lists the advertiser's own account, or
  for an agency login the agency's active clients, and the member picks one.
- The server imports the account's campaigns, ad groups, ads and their daily figures, on the same
  schedule and with the same manual refresh, status and disconnect behaviour as Meta and Google.
  Spend is taken without VAT. Conversions and revenue are Direct's own, counted by Yandex Metrica,
  and results equal conversions.
- A Yandex campaign, ad group and ad report the result type conversions.
- Opening an ad's preview reads its creative from Direct and keeps it, as for Meta and Google:
  images, video thumbnails with a link to watch, and the ad's headlines and texts.
- Each Yandex connection gets a panel titled «Яндекс Директ» and a tab `Яндекс · account`.
- The provider window makes **Yandex** selectable.
- Out of scope: Direct leads, Metrica goals shown one by one as their own result types, Metrica
  traffic figures (bounce rate, depth), and the search query report. Goals are left for a
  follow-up once real accounts show which of Yandex's own figures the buyers want.

## Capabilities

### New Capabilities

- `yandex-direct-project-integration`: connecting a Yandex Direct account to a project through
  Yandex sign-in, and importing its campaigns and figures.

### Modified Capabilities

- `meta-project-integration`: the provider window offers Yandex as selectable; a Yandex panel is
  titled by the Я mark and «Яндекс Директ».
- `ad-creatives`: an ad imported from Yandex Direct carries its Yandex creative.
- `result-types`: Yandex campaigns, ad groups and ads report the type conversions.

## Impact

- Prisma: the pending sign-in record, used by Google today, gains a provider so Yandex shares it;
  `provider` on the integration gains `YANDEX`, the value its campaigns already use as their
  channel.
- API: Yandex OAuth start and callback routes, account listing, a Direct client producing the
  import snapshot and creatives, error mapping, OpenAPI.
- Web: Yandex in the provider window, the account choice, the Yandex panel and tab, copy.
- Configuration: Yandex OAuth client id and secret, the redirect address and a switch to Direct's
  sandbox; none of them is stored in the repository. The OAuth application must be registered at
  oauth.yandex.ru, and full access to the Direct API requested and approved, before real accounts
  can be connected.
