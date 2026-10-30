# syntax=docker/dockerfile:1

# --- Этап 1: Сборка React (Vite) ---
FROM node:20-slim AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

# --- Этап 2: Python + FastAPI ---
FROM python:3.12-slim
WORKDIR /app
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/app ./app
# Собранный фронтенд раздаёт сам FastAPI (см. FRONTEND_DIST в app/core/config.py)
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist
ENV FRONTEND_DIST=/app/frontend/dist

# Хостинги с docker указывают порт через $PORT (Hugging Face Spaces: 7860, Koyeb: 8000+); локально — 8000
EXPOSE 8000
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
