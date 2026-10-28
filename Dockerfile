# syntax=docker/dockerfile:1

# --- Этап 1: Сборка React (Vite) ---
FROM node:20-slim AS frontend-builder
WORKDIR /app/frontend
# Копируем зависимости и устанавливаем их
COPY frontend/package*.json ./
RUN npm install
# Копируем исходный код и собираем проект
COPY frontend/ ./
RUN npm run build

# --- Этап 2: Настройка Python (FastAPI) ---
FROM python:3.12-slim AS backend-runtime
WORKDIR /app

# Устанавливаем системные зависимости (если нужны)
# RUN apt-get update && apt-get install -y ... && rm -rf /var/lib/apt/lists/*

# Копируем и устанавливаем Python-зависимости
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Копируем исходный код бэкенда
COPY backend/app ./app

# Копируем собранные статические файлы из первого этапа
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Указываем, что приложение будет слушать порт 8000
EXPOSE 8000

# Запускаем Uvicorn. Обратите внимание на путь к приложению: app.main:app
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]