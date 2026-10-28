# VOID DOTA 2 ANALYTICS

Этап 1: каркас, интеграция с OpenDota, кеш, страница матча.

Нужны Python 3.10+ и Node.js 18+.

1. Запустите `start_backend.bat` (API: http://localhost:8000, Swagger: http://localhost:8000/docs).
2. В другом окне запустите `start_frontend.bat` (сайт: http://localhost:5173).
3. Введите Match ID на главной странице.

Тесты backend: `cd backend`, `.venv\Scripts\activate`, `pytest`.

Миграции Alembic и остальные разделы плана добавляются на следующих этапах.
