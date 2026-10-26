# Vulkanchik Music — Firebot Plugin

Повне покриття [Music API](https://vulkanchik.com/docs/music-api) (`/api/music/v1`) для Firebot.

## Вимоги

- **Firebot 5.67+** (нова система Plugins)
- Windows / macOS / Linux (чистий JS, без native-модулів)
- Токен `mct_…` з сайту: **Музика → API**
- Для auto-chat: на сайті **Мій бот (через API)** (`chatCommandsVia=external`)

## Встановлення

Firebot приймає **лише один `.js` файл** (не zip).

1. Завантажте `vulkanchik-music.js` з вкладки **Музика → API** (або `{ORIGIN}/downloads/firebot/vulkanchik-music.js`), або з [GitHub Releases](https://github.com/Gafka032/vulkanchik-music-firebot/releases).
2. У Firebot **5.67+**: **Tools → Plugin Manager** → Install from file → виберіть `vulkanchik-music.js`.
3. Увімкніть плагін, відкрийте **Configure**:
   - Site origin: `https://vulkanchik.com` (або ваш домен)
   - Music API token: `mct_…`
   - Auto-forward `!` commands — увімкніть, якщо Firebot володіє чатом
   - Post API replies to Twitch chat — щоб відповіді писав Firebot
4. Перезавантажте вікно Firebot, якщо UI просить після install.

**Код (MIT):** [github.com/Gafka032/vulkanchik-music-firebot](https://github.com/Gafka032/vulkanchik-music-firebot) — issues / PR вітаються ([CONTRIBUTING.md](CONTRIBUTING.md)).

На сайті також є блок **«Як користуватись?»** (Музика → API) з командами та підказками UI.

## Як користуватись?

### Чатові команди (типові аліаси на сайті)

Аліаси й хто може їх викликати — вкладка **Музика → Команди**. Плагін їх не дублює: з auto-forward просто шле рядок у `POST /chat`.

| Команда | Дія | Хто (типово) |
|---------|-----|--------------|
| `!замов` / `!пісня` / `!sr` | замовити трек | усі |
| `!зараз` / `!щограє` | що грає | усі |
| `!черга` / `!queue` | черга | усі |
| `!прибрати` / `!rm` | прибрати свій трек | усі |
| `!скіп` / `!пропустити` | skip | мод+ |
| `!грати` / `!пауза` | play / pause | мод+ |
| `!гучність 50` | гучність 0–100 | мод+ |

Не робіть у Firebot окремі Chat Commands на ті самі `!…`, якщо auto-forward увімкнено.

### Ефекти в Firebot (категорія Vulkanchik Music)

| Effect | Навіщо стрімеру |
|--------|-----------------|
| Skip / Play / Pause / **Toggle Play/Pause** / Volume / Seek | пульт без чату (toggle — одна кнопка) |
| Enqueue (streamer) | додати трек собі |
| Chat command | разово виконати рядок як у чаті |
| Get state | оновити `$vulkanchikCurrentTitle`, `$vulkanchikQueueLength`, … |
| Import backup / Points / Roles | адмін-операції через API |

### Змінні

Після Get state або іншої дії зі snapshot: `$vulkanchikCurrentTitle`, `$vulkanchikCurrentArtist`, `$vulkanchikQueueLength`, `$vulkanchikPlaybackState`, `$vulkanchikVolume`, `$vulkanchikSnapshotJson`, `$vulkanchikQueueJson`, `$vulkanchikRolesJson`.

## Що всередині (API)

| Група | Effects / можливості | API |
|-------|----------------------|-----|
| Чат | Chat command; auto `!…` | `POST /chat` |
| Черга | Enqueue streamer, Song request, Remove, Reorder, Get state | `/queue`, `/requests`, … |
| Транспорт | Skip, Play, Pause, Toggle Play/Pause, Volume, Seek, Claim leader | `/skip` … `/leader` (toggle = `/state` + `/play`\|`/pause`) |

Кожен API-виклик має **таймаут 10 с**. Помилка / таймаут логується в Firebot, але ефект вважається успішним (`apiOk=false` у outputs), щоб наступні ефекти в тому ж списку продовжили виконуватись.
| Налаштування | Get / Patch settings, chatCommandsVia, accept chat/points | `/settings` |
| Бекап | Get / Put / Import | `/backup` |
| Бали | List mappings, Twitch rewards, Add / Update / Delete | `/points/rewards` |
| Ролі | Get / Put roles JSON | `/roles` |

## Розробка / реліз плагіна

```bash
npm install
npm test
npm run build
# → dist/vulkanchik-music.js + dist/plugin-manifest.json
```

Щоб одразу покласти артефакти в монорепо сайту (локально):

```bash
export VULKANCHIK_DOWNLOADS_DIR=/path/to/Вулканчік/frontend/public/downloads/firebot
export VULKANCHIK_GUIDES_DIR=/path/to/Вулканчік/frontend/src/content/guides
npm run build
```

Реліз для стрімерів:

1. Підніміть `version` + `vulkanchik.releaseNotesUk` у `package.json`.
2. Merge у `main` → GitHub Release `vX.Y.Z` (CI завантажить assets).
3. У монорепо Вулканчіка: `make sync-plugins` → commit → деплой. На **Музика → API** з’явиться банер оновлення.

## Checklist (після install)

1. Токен `mct_…` у параметрах плагіна + Site origin.
2. На сайті: **Мій бот (через API)** + auto-forward у плагіні → `!замов` у чаті додає трек.
3. Effect **Skip** / **Play** / **Pause** змінює плеєр.
4. Effect **Import backup playlist** імпортує URL.
5. Effect **List points mappings** повертає JSON мапінгів.
6. Variables `$vulkanchikCurrentTitle` / `$vulkanchikQueueLength` після **Get state**.

⚠️ **Put roles** і великий JSON у **Patch settings** (`commands`) — повна заміна конфігу; спочатку зробіть **Get**, потім редагуйте.
