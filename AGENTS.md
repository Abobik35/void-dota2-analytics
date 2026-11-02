# VOID — Dota 2 Analytics

Контекст проекта, который надо знать в любом новом чате.

## Что это

Аналитика матчей Dota 2 по данным OpenDota: FastAPI-бэкенд (`backend/`) + React/Vite-фронтенд (`frontend/`). Монорепозиторий, деплоится одним контейнером (FastAPI раздаёт собранный `frontend/dist` при `FRONTEND_DIST`). GitHub: `Abobik35/void-dota2-analytics`.

Версия в трёх местах синхронно: `backend/app/main.py`, `frontend/package.json`, и запись в `frontend/src/changelog/releases.ts` (Patch Notes). Значимые изменения — обязательно новая запись в releases.

## Команды

- Запуск всего: `start.bat` в корне (uvicorn `--reload` на :8000 + vite на :5173).
- Тесты бэкенда: из `backend/` → `python -m pytest tests -q --ignore=tests/test_rating.py` (ожидается 34 passed).
  - `tests/test_rating.py` устарел (импортирует несуществующий модуль) — всегда игнорить, не запускать.
- Проверка типов фронта: из `frontend/` → `npx tsc --noEmit`.

## Известные грабли

- **uvicorn --reload не подхватывает правки**: остаются «зомби»-дети multiprocessing, в их cmdline нет слова `uvicorn`. Перезапуск целиком: убить все процессы с `*uvicorn*` И `*spawn_main*` в CommandLine, потом снова `start.bat`. После правок бэкенда проверять фактическую версию (`/openapi.json` → `info.version`).
- Иконки героев/предметов/способностей — **локально** в `frontend/public/assets/(heroes|items|abilities)` (~60 МБ, в git). Компонент `CdnImg` идёт в `assets/`, на Steam CDN — только фолбэк. На CDN физически нет ~332 иконок способностей — для них текстовый фолбэк, это норма.
- Идемпотентный скрипт докачки иконок: `C:\Windows\Temp\opencode\download_assets.py`.
- PowerShell: многострочный `python -c` вешается; системный питон — `C:\Users\-Nastlo\AppData\Local\Programs\Python\Python313\python.exe`, проектный — `backend\.venv\Scripts\python.exe` (вызывать через `& "путь"`).

## Деплой

- Хостинг выбран: **Back4App Containers** (docker-хостинг, деплой из GitHub-репозитория по `Dockerfile`, env: `PUBLIC_URL`, `SECRET_KEY`). Запасные варианты описаны в README и `render.yaml`.
- HF Space `Abobik35/void` существует, но приватный и более не используется по решению владельца.
- Docker локально не установлен — docker-сборка проверяется только на хостинге.

## Окружение владельца

Git push работает: глобально `credential.helper = manager` (GCM), учётка GitHub сохранена. Не просить владельца вводить токены в чат.
