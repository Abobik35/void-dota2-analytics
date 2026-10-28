from datetime import timedelta
from fastapi import APIRouter, Path, Query

from app.schemas.player import PlayerAnalytics, PlayerMatch, PlayerMatches, PlayerProfile
from app.services.analytics.player import aggregate
from app.services.opendota.client import SourceError, fetch_json, invalidate_player, send_json
from app.services.opendota.normalizer import hero_info, index_heroes
from app.services.opendota.players import matches_path, normalize_row

router = APIRouter(prefix="/api/v1", tags=["players"])
NOT_FOUND = "Игрок не найден в OpenDota."
STEAM64_BASE = 76561197960265728


def to_account_id(n: int) -> int:
    """SteamID64 → Account ID (OpenDota принимает только Account ID; для SteamID64 отдаёт пустой список)."""
    return n - STEAM64_BASE if n >= STEAM64_BASE else n
def _ttl(data) -> timedelta:
    """Пустые ответы (игрок ещё не загружен в OpenDota) кешируем ненадолго, чтобы не застрять на пустоте."""
    empty = not data or (isinstance(data, dict) and not (data.get("win") or data.get("lose") or data.get("profile")))
    return timedelta(seconds=30) if empty else timedelta(minutes=10)


async def _heroes() -> dict[int, dict]:
    return index_heroes(await fetch_json("/heroes", lambda _: timedelta(hours=24)))


async def _rows(account_id: int, limit: int, offset: int, days, hero_id, game_mode) -> list[dict]:
    raw = await fetch_json(matches_path(account_id, limit, offset, days, hero_id, game_mode), _ttl, NOT_FOUND)
    if not isinstance(raw, list):
        raise SourceError(502, "bad_response", "OpenDota вернул ответ в неожиданном формате.")
    try:
        recent = await fetch_json(f"/players/{account_id}/recentMatches", _ttl, NOT_FOUND)
    except SourceError:
        recent = []
    extra = {r["match_id"]: r for r in recent if isinstance(r, dict) and "match_id" in r}
    return [normalize_row(r, extra.get(r["match_id"])) for r in raw if isinstance(r, dict) and "match_id" in r]


@router.get("/players/{account_id}", response_model=PlayerProfile)
async def get_player(account_id: int = Path(ge=1)):
    account_id = to_account_id(account_id)
    info = await fetch_json(f"/players/{account_id}", _ttl, NOT_FOUND)
    try:
        wl = await fetch_json(f"/players/{account_id}/wl", _ttl, NOT_FOUND)
    except SourceError:
        wl = {}
    info = info if isinstance(info, dict) else {}
    profile = info.get("profile") or {}
    wins, losses = wl.get("win"), wl.get("lose")
    if not profile and not (wins or losses):
        raise SourceError(404, "not_found", "Игрок не найден или скрыл историю матчей.")
    total = (wins or 0) + (losses or 0)
    return PlayerProfile(
        account_id=account_id, name=profile.get("personaname") or profile.get("name"),
        avatar=profile.get("avatarfull"), rank_tier=info.get("rank_tier"),
        mmr_estimate=(info.get("mmr_estimate") or {}).get("estimate"),
        lifetime_wins=wins, lifetime_losses=losses,
        lifetime_win_rate=round(wins / total * 100, 1) if wins is not None and total else None,
    )


@router.get("/players/{account_id}/matches", response_model=PlayerMatches)
async def get_player_matches(account_id: int = Path(ge=1), limit: int = Query(20, ge=1, le=100),
                             offset: int = Query(0, ge=0), days: int | None = Query(None, ge=1, le=3650),
                             hero_id: int | None = Query(None, ge=1), game_mode: int | None = Query(None, ge=0)):
    account_id = to_account_id(account_id)
    rows = await _rows(account_id, limit, offset, days, hero_id, game_mode)
    heroes = await _heroes()
    items = [PlayerMatch(**r, hero_name=hero_info(heroes, r["hero_id"])[0], hero_img=hero_info(heroes, r["hero_id"])[1])
             for r in rows]
    return PlayerMatches(items=items, next_offset=offset + len(rows) if len(rows) == limit else None)


@router.get("/players/{account_id}/analytics", response_model=PlayerAnalytics)
async def get_player_analytics(account_id: int = Path(ge=1), limit: int = Query(100, ge=1, le=200),
                               days: int | None = Query(None, ge=1, le=3650),
                               hero_id: int | None = Query(None, ge=1), game_mode: int | None = Query(None, ge=0)):
    account_id = to_account_id(account_id)
    agg = aggregate(await _rows(account_id, limit, 0, days, hero_id, game_mode))
    heroes = await _heroes()
    top = []
    for h in agg.pop("top_heroes"):
        name, img = hero_info(heroes, h["hero_id"])
        top.append({**h, "hero_name": name, "hero_img": img})
    return PlayerAnalytics(**agg, top_heroes=top)


@router.post("/players/{account_id}/refresh")
async def refresh_player(account_id: int = Path(ge=1)):
    """Сбрасывает наш кеш по игроку и просит OpenDota обновить его историю (если они это разрешают)."""
    account_id = to_account_id(account_id)
    cleared = invalidate_player(account_id)
    try:
        await send_json("POST", f"/players/{account_id}/refresh")
        requested = True
    except SourceError:
        requested = False
    return {"cache_cleared": cleared, "refresh_requested": requested}
