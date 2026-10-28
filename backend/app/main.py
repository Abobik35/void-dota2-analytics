from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import auth, compare, debug, matches, players
from app.core.config import settings
from app.db.session import Base, engine
from app.services.opendota.client import SourceError

Base.metadata.create_all(engine)
app = FastAPI(title="VOID DOTA 2 ANALYTICS", version="0.1.0")
app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins.split(","),
                   allow_methods=["GET", "POST"], allow_headers=["*"])
app.include_router(matches.router)
app.include_router(players.router)
app.include_router(compare.router)
app.include_router(auth.router)
app.include_router(debug.router)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"], # для локальной разработки
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# Путь к собранным файлам фронтенда
FRONTEND_DIST = os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "dist")

# Монтируем статические файлы (если они есть)
if os.path.exists(FRONTEND_DIST):
    app.mount("/assets", StaticFiles(directory=os.path.join(FRONTEND_DIST, "assets")), name="assets")
    
    # Отдаем index.html для всех остальных маршрутов (для React Router)
    @app.get("/{full_path:path}")
    async def serve_react_app(full_path: str):
        return FileResponse(os.path.join(FRONTEND_DIST, "index.html"))
@app.exception_handler(SourceError)
async def source_error(_: Request, e: SourceError):
    return JSONResponse(status_code=e.status, content={"error": {"code": e.code, "message": e.message}})
