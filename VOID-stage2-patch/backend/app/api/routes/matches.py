from datetime import timedelta
from fastapi import APIRouter, Path

from app.schemas.analytics import MatchAnalytics, Timeline
from app.schemas.match import MatchOut
from app.services.analytics.team import team_analytics
from app.services.opendota.client import fetch_json
from app.services.opendota.normalizer import index_heroes, normalize_match

router = APIRouter(prefix="/api/v1", tags=["matches"])


def _match_ttl(raw: dict) -> timedelta:
    # Необработанный матч может дополниться позже — кешируем ненадолго.
    return timedelta(days=7) if raw.get("version") is not None else timedelta(minutes=10)


async def _heroes() -> dict[int, dict]:
    return index_heroes(await fetch_json("/heroes", lambda _: timedelta(hours=24)))


async def _raw(match_id: int) -> dict:
    return await fetch_json(f"/matches/{match_id}", _match_ttl)


@router.get("/health")
def health():
    return {"status": "ok"}


@router.get("/heroes")
async def heroes():
    return list((await _heroes()).values())


@router.get("/matches/{match_id}", response_model=MatchOut)
async def get_match(match_id: int = Path(ge=1)):
    return normalize_match(await _raw(match_id), await _heroes())


@router.get("/matches/{match_id}/analytics", response_model=MatchAnalytics)
async def get_analytics(match_id: int = Path(ge=1)):
    return team_analytics(normalize_match(await _raw(match_id), await _heroes()))


@router.get("/matches/{match_id}/timeline", response_model=Timeline)
async def get_timeline(match_id: int = Path(ge=1)):
    raw = await _raw(match_id)
    gold = raw.get("radiant_gold_adv") or []
    if not gold:
        return Timeline(available=False, reason="OpenDota ещё не обработал реплей: данных по минутам нет.")
    return Timeline(available=True, minutes=list(range(len(gold))), gold_adv=gold,
                    xp_adv=raw.get("radiant_xp_adv") or [])
