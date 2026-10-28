"""Диагностика: что именно видит наш сервер в ответе OpenDota и что лежит в кеше. Только для локального запуска."""
import json

import httpx
from fastapi import APIRouter, Query

from app.core.config import settings
from app.db.session import CachedResponse, SessionLocal

router = APIRouter(prefix="/api/v1", tags=["debug"])


@router.get("/debug/opendota")
async def debug_opendota(path: str = Query(..., pattern=r"^/(players|matches)/\d+.*")):
    params = {"api_key": settings.opendota_api_key} if settings.opendota_api_key else None
    out: dict = {"path": path, "base_url": settings.opendota_base_url, "api_key_set": bool(settings.opendota_api_key)}
    try:
        async with httpx.AsyncClient(timeout=settings.request_timeout_s) as c:
            r = await c.get(settings.opendota_base_url + path, params=params)
        url = str(r.request.url)
        if settings.opendota_api_key:
            url = url.replace(settings.opendota_api_key, "***")
        body = r.text
        out |= {"url": url, "status": r.status_code, "content_type": r.headers.get("content-type"),
                "length": len(body), "preview": body[:500]}
        try:
            data = r.json()
            out["json_items"] = len(data) if isinstance(data, list) else None
        except ValueError:
            out["json_items"] = "не JSON"
    except httpx.HTTPError as e:
        out["error"] = f"{type(e).__name__}: {e}"
    with SessionLocal() as db:
        row = db.get(CachedResponse, path)
        if row:
            payload = json.loads(row.payload)
            out["cache"] = {"exists": True, "expires_at": row.expires_at.isoformat(), "fetched_at": row.fetched_at.isoformat(),
                            "items": len(payload) if isinstance(payload, list) else None}
        else:
            out["cache"] = {"exists": False}
    import re
    m = re.match(r"^/players/(\d+)", path)
    if m and int(m.group(1)) >= 76561197960265728:
        out["hint"] = (f"Это SteamID64. OpenDota ждёт Account ID: используйте {int(m.group(1)) - 76561197960265728} "
                       "(SteamID64 минус 76561197960265728). С SteamID64 он отвечает пустым списком.")
    return out
