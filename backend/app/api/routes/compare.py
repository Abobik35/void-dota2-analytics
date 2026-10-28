from fastapi import APIRouter, Query

from app.api.routes.players import _heroes, _rows, get_player, get_player_analytics, to_account_id
from app.schemas.compare import CommonHero, CompareOut, CompareSide
from app.services.analytics.compare import common_heroes, sample_warnings
from app.services.opendota.client import SourceError
from app.services.opendota.normalizer import hero_info

router = APIRouter(prefix="/api/v1", tags=["compare"])


@router.get("/compare", response_model=CompareOut)
async def compare(a: int = Query(..., ge=1), b: int = Query(..., ge=1),
                  days: int | None = Query(None, ge=1, le=3650), limit: int = Query(100, ge=1, le=200)):
    a, b = to_account_id(a), to_account_id(b)
    if a == b:
        raise SourceError(400, "bad_request", "Выберите двух разных игроков.")
    sides = []
    for acc in (a, b):
        try:
            profile = await get_player(acc)
            analytics = await get_player_analytics(account_id=acc, limit=limit, days=days, hero_id=None, game_mode=None)
        except SourceError as e:
            raise SourceError(e.status, e.code, f"Игрок {acc}: {e.message}")
        sides.append(CompareSide(profile=profile, analytics=analytics))
    rows_a, rows_b = await _rows(a, limit, 0, days, None, None), await _rows(b, limit, 0, days, None, None)  # из кеша
    heroes = await _heroes()
    common = []
    for c in common_heroes(rows_a, rows_b):
        name, img = hero_info(heroes, c["hero_id"])
        common.append(CommonHero(hero_name=name, hero_img=img, **c))
    return CompareOut(a=sides[0], b=sides[1], common_heroes=common,
                      warnings=sample_warnings(sides[0].analytics.sample_size, sides[1].analytics.sample_size))
