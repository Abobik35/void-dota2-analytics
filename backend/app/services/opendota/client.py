import json
from datetime import datetime, timedelta
from typing import Any, Callable

import httpx

from app.core.config import settings
from app.db.session import CachedResponse, SessionLocal


class SourceError(Exception):
    def __init__(self, status: int, code: str, message: str):
        self.status, self.code, self.message = status, code, message


async def _call(method: str, path: str, not_found: str = "Матч не найден в OpenDota.") -> Any:
    params = {"api_key": settings.opendota_api_key} if settings.opendota_api_key else None
    try:
        async with httpx.AsyncClient(timeout=settings.request_timeout_s) as c:
            r = await c.request(method, settings.opendota_base_url + path, params=params)
    except httpx.TimeoutException:
        raise SourceError(504, "source_timeout", "OpenDota не ответил вовремя. Повторите запрос позже.")
    except httpx.HTTPError:
        raise SourceError(502, "source_unavailable", "Не удалось связаться с OpenDota.")

    if r.status_code == 404:
        raise SourceError(404, "not_found", not_found)
    if r.status_code == 429:
        raise SourceError(429, "rate_limited", "Превышен лимит запросов к OpenDota. Подождите минуту.")
    if r.status_code >= 400:
        hint = " Возможно, реплей этого матча уже недоступен." if method == "POST" else ""
        raise SourceError(502, "source_error", f"OpenDota вернул ошибку {r.status_code}.{hint}")
    try:
        return r.json()
    except ValueError:
        if method == "POST":  # у запросов на обработку тело ответа может быть пустым
            return {}
        raise SourceError(502, "bad_response", "OpenDota вернул ответ в неожиданном формате.")


async def fetch_json(path: str, ttl_for: Callable[[Any], timedelta],
                     not_found: str = "Матч не найден в OpenDota.") -> Any:
    """GET к OpenDota с кешем в SQLite. TTL зависит от содержимого ответа."""
    now = datetime.utcnow()
    with SessionLocal() as db:
        row = db.get(CachedResponse, path)
        if row and row.expires_at > now:
            return json.loads(row.payload)
    data = await _call("GET", path, not_found)
    with SessionLocal() as db:
        db.merge(CachedResponse(key=path, payload=json.dumps(data), fetched_at=now,
                                expires_at=now + ttl_for(data)))
        db.commit()
    return data


async def send_json(method: str, path: str) -> Any:
    """Запрос без кеша (например, POST /request/{match_id})."""
    return await _call(method, path)


def invalidate(path: str) -> None:
    with SessionLocal() as db:
        row = db.get(CachedResponse, path)
        if row:
            db.delete(row)
            db.commit()


def invalidate_player(account_id: int) -> int:
    """Удаляет из кеша все ответы по игроку (профиль, W/L, матчи, последние матчи). Возвращает число записей."""
    base = f"/players/{account_id}"
    with SessionLocal() as db:
        rows = db.query(CachedResponse).filter((CachedResponse.key == base) | CachedResponse.key.like(base + "/%")).all()
        for r in rows:
            db.delete(r)
        db.commit()
        return len(rows)
