from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse

from app.api.routes import auth, compare, debug, matches, players
from app.core.config import settings
from app.db.session import Base, engine
from app.services.opendota.client import SourceError

Base.metadata.create_all(engine)
app = FastAPI(title="VOID DOTA 2 ANALYTICS", version="0.16.0")
app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins.split(","),
                   allow_methods=["GET", "POST"], allow_headers=["*"])
app.include_router(matches.router)
app.include_router(players.router)
app.include_router(compare.router)
app.include_router(auth.router)
app.include_router(debug.router)


@app.exception_handler(SourceError)
async def source_error(_: Request, e: SourceError):
    return JSONResponse(status_code=e.status, content={"error": {"code": e.code, "message": e.message}})


# ===== Раздача собранного фронтенда (для публикации одним сервисом, например на Render) =====
# Локальная разработка start.bat не трогает: если папка не задана или её нет — блок просто не активируется.
_DIST = Path(settings.frontend_dist) if settings.frontend_dist else None
if _DIST is not None and _DIST.is_dir():
    _INDEX = _DIST / "index.html"

    @app.get("/{full_path:path}", include_in_schema=False)
    async def spa(full_path: str):
        """Static-файлы по прямому пути, всё остальное — index.html (роуты React)."""
        candidate = (_DIST / full_path).resolve()
        if full_path and candidate.is_file() and str(candidate).startswith(str(_DIST.resolve())):
            return FileResponse(candidate)
        return FileResponse(_INDEX)

