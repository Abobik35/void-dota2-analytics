from urllib.parse import urlencode


def matches_path(account_id: int, limit: int, offset: int, days: int | None = None,
                 hero_id: int | None = None, game_mode: int | None = None) -> str:
    q: dict[str, int] = {"limit": limit, "offset": offset}
    if days:
        q["date"] = days
    if hero_id:
        q["hero_id"] = hero_id
    if game_mode is not None:
        q["game_mode"] = game_mode
    return f"/players/{account_id}/matches?{urlencode(q)}"


def normalize_row(raw: dict, extra: dict | None = None) -> dict:
    """Строка истории матчей игрока. extra — запись из recentMatches (даёт GPM/XPM)."""
    slot, radiant_win = raw.get("player_slot"), raw.get("radiant_win")
    won = None if slot is None or radiant_win is None else (slot < 128) == radiant_win
    k, d, a = (raw.get(x) or 0 for x in ("kills", "deaths", "assists"))
    ex = extra or {}
    return {
        "match_id": raw["match_id"], "start_time": raw.get("start_time"), "duration": raw.get("duration"),
        "game_mode": raw.get("game_mode"), "lobby_type": raw.get("lobby_type"), "hero_id": raw.get("hero_id") or 0,
        "won": won, "kills": k, "deaths": d, "assists": a, "kda": round((k + a) / max(d, 1), 2),
        "gpm": ex.get("gold_per_min"), "xpm": ex.get("xp_per_min"), "last_hits": ex.get("last_hits"),
    }
