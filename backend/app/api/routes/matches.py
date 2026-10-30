import asyncio
import time
from datetime import timedelta
from urllib.parse import urlencode
from fastapi import APIRouter, Path

from app.schemas.analytics import MatchAnalytics, Timeline
from app.schemas.abilities import AbilitiesOut
from app.schemas.flow import FlowOut
from app.schemas.items import ItemsOut
from app.schemas.mistakes import MistakesOut
from app.schemas.timings import TimingsOut
from app.schemas.match import MatchOut
from app.schemas.parse import ParseRequestOut, ParseStatus
from app.schemas.void_rating import VoidRatingOut
from app.services.analytics.team import team_analytics
from app.services.analytics.benchmarks import parse_benchmarks
from app.services.analytics.void_extras import extract_extras
from app.services.analytics.void_rating import compute_void_rating
from app.services.opendota.client import SourceError, fetch_json, invalidate, send_json
from app.services.opendota.constants import load_ability_constants, load_item_constants
from app.services.opendota.flow import build_flow
from app.services.opendota.items import build_items
from app.services.opendota.abilities import build_abilities
from app.services.opendota.jobs import extract_job_id
from app.services.opendota.mistakes import build_mistakes
from app.services.opendota.timings import NOTE, assemble, pick_key_items, summarize_timings
from app.services.opendota.normalizer import index_heroes, is_parsed, normalize_match

router = APIRouter(prefix="/api/v1", tags=["matches"])


def _match_ttl(raw: dict) -> timedelta:
    # Необработанный матч может дополниться позже — кешируем ненадолго.
    return timedelta(days=7) if is_parsed(raw) else timedelta(minutes=10)


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


@router.get("/matches/{match_id}/void-rating", response_model=VoidRatingOut)
async def get_void_rating(match_id: int = Path(ge=1)):
    raw, heroes = await _raw(match_id), await _heroes()
    match = normalize_match(raw, heroes)
    sem = asyncio.Semaphore(3)  # бенчмарки героев, кеш на неделю

    async def one(hero_id: int):
        async with sem:
            try:
                data = await fetch_json(f"/benchmarks?{urlencode({'hero_id': hero_id})}",
                                        lambda d: timedelta(days=7) if d else timedelta(hours=12))
            except SourceError:
                return hero_id, None
        return hero_id, parse_benchmarks(data)

    results = await asyncio.gather(*(one(h) for h in {p.hero_id for p in match.players if p.hero_id}))
    bench = {h: b for h, b in results if b}
    return compute_void_rating(match, extract_extras(raw, heroes), bench)


_recent_requests: dict[int, float] = {}  # match_id -> время последнего запроса обработки
_REQUEST_COOLDOWN_S = 300


@router.post("/matches/{match_id}/parse", response_model=ParseRequestOut)
async def request_parse(match_id: int = Path(ge=1)):
    if is_parsed(await _raw(match_id)):
        return ParseRequestOut(status="already_parsed")
    now = time.monotonic()
    if now - _recent_requests.get(match_id, -1e9) < _REQUEST_COOLDOWN_S:
        return ParseRequestOut(status="recently_requested")
    data = await send_json("POST", f"/request/{match_id}")
    _recent_requests[match_id] = now
    return ParseRequestOut(status="queued", job_id=extract_job_id(data))


@router.get("/matches/{match_id}/parse-status", response_model=ParseStatus)
async def parse_status(match_id: int = Path(ge=1)):
    invalidate(f"/matches/{match_id}")  # берём свежий ответ, а не кеш
    return ParseStatus(parsed=is_parsed(await _raw(match_id)))


@router.get("/matches/{match_id}/items", response_model=ItemsOut)
async def get_items(match_id: int = Path(ge=1)):
    raw, heroes = await _raw(match_id), await _heroes()
    meta = {p.slot: p.model_dump() for p in normalize_match(raw, heroes).players}
    ids, consts = await load_item_constants()
    return ItemsOut(**build_items(raw, meta, ids, consts))


@router.get("/matches/{match_id}/flow", response_model=FlowOut)
async def get_flow(match_id: int = Path(ge=1)):
    return FlowOut(**build_flow(await _raw(match_id), await _heroes()))


@router.get("/matches/{match_id}/mistakes", response_model=MistakesOut)
async def get_mistakes(match_id: int = Path(ge=1)):
    raw, heroes = await _raw(match_id), await _heroes()
    meta = {p.slot: p.model_dump() for p in normalize_match(raw, heroes).players}
    return MistakesOut(**build_mistakes(raw, heroes, meta))


@router.get("/matches/{match_id}/abilities", response_model=AbilitiesOut)
async def get_abilities(match_id: int = Path(ge=1)):
    raw, heroes = await _raw(match_id), await _heroes()
    meta = {p.slot: p.model_dump() for p in normalize_match(raw, heroes).players}
    ids, consts = await load_ability_constants()
    return AbilitiesOut(**build_abilities(raw, meta, ids, consts))


@router.get("/matches/{match_id}/item-timings", response_model=TimingsOut)
async def get_item_timings(match_id: int = Path(ge=1)):
    raw, heroes = await _raw(match_id), await _heroes()
    meta = {p.slot: p.model_dump() for p in normalize_match(raw, heroes).players}
    ids, consts = await load_item_constants()
    items = build_items(raw, meta, ids, consts)
    if items["data_status"] != "full":
        return TimingsOut(available=False, reason="История покупок есть только у обработанных матчей.", note=NOTE)
    hero_by_slot = {p.get("player_slot", 0): p.get("hero_id") for p in raw.get("players", [])}
    pairs = {(hero_by_slot.get(pl["slot"]), it["key"]) for pl in items["players"] for it in pick_key_items(pl["purchases"])
             if hero_by_slot.get(pl["slot"])}
    sem = asyncio.Semaphore(3)  # не заваливаем OpenDota запросами

    async def one(hero_id: int, key: str):
        async with sem:
            try:
                rows = await fetch_json(f"/scenarios/itemTimings?{urlencode({'item': key, 'hero_id': hero_id})}",
                                        lambda d: timedelta(days=7) if d else timedelta(hours=12))
            except SourceError:
                return (hero_id, key), None
        return (hero_id, key), summarize_timings(rows if isinstance(rows, list) else [])

    bench = dict(await asyncio.gather(*(one(h, k) for h, k in pairs)))
    players, highlights = assemble(items["players"], hero_by_slot, bench)
    return TimingsOut(available=True, note=NOTE, highlights=highlights, players=players)
