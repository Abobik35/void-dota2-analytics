# Локальные иконки VOID

Сюда загружаются иконки, которые приложение должно брать **с диска**, а не скачивать с CDN Steam.

## Папки

| Папка        | Что кладём                                          |
|--------------|-----------------------------------------------------|
| `heroes/`    | аватарки героев (портреты в списках, MVP и т.д.)     |
| `items/`     | иконки предметов                                     |
| `neutrals/`  | иконки нейтралок / нейтральных предметов (токенов)  |

## Правило именования (важно)

Имя файла = последняя часть ссылки на картинку с CDN Steam, без изменений.

- Герой: `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/antimage.png`
  → файл **`antimage.png`** (Doom → `doom_bringer.png`, Underlord → `abyssal_underlord.png`,
  Keeper of the Light → `keeper_of_the_light.png`, и т.п.)
- Предмет: `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/blink.png`
  → файл **`blink.png`** (Black King Bar → `black_king_bar.png`)
- Для героев также принимается полное имя с префиксом: `npc_dota_hero_antimage.png`.

## Как это работает

Приложение сначала пытается открыть `/assets/heroes|items|neutrals/<имя>.png`.
Если файл найден — картинка не скачивается из интернета.
Если файла нет — молча используется обычная ссылка на CDN, ничего не ломается.

Поиск предметов идёт сначала в `items/`, затем в `neutrals/`,
так что нейтралки можно держать в любой из этих папок.
