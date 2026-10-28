"""Сравнение времени покупки предметов с типичным для героя (OpenDota Scenarios / itemTimings). Чистая логика без сети."""
from app.services.opendota.flow import SIDE_RU, clock

KEY_COST = 2000
MAX_ITEMS = 4
EVEN = 60  # в пределах минуты — «как обычно»
NOTE = ("Типичное время — по статистике OpenDota для этого героя и предмета (все звания и режимы, где есть данные), точность около минуты. "
        "Это ориентир, а не норма: порядок покупок зависит от роли, драфта и хода игры.")


def _num(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def summarize_timings(rows) -> dict | None:
    """Ряды {time, games, wins} → медиана и квартили покупки (взвешено по числу игр) и сами корзины."""
    buckets = []
    for r in rows or []:
        if not isinstance(r, dict):
            continue
        t, g, w = _num(r.get("time")), _num(r.get("games")), _num(r.get("wins"))
        if t is not None and g and g > 0:
            buckets.append({"time": t, "games": int(g), "wins": int(w or 0)})
    if not buckets:
        return None
    if max(b["time"] for b in buckets) < 200:  # если время пришло в минутах
        for b in buckets:
            b["time"] *= 60
    buckets.sort(key=lambda b: b["time"])
    total = sum(b["games"] for b in buckets)

    def pct(q: float) -> int:
        acc = 0
        for b in buckets:
            acc += b["games"]
            if acc >= q * total:
                return int(b["time"])
        return int(buckets[-1]["time"])

    return {"median": pct(0.5), "p25": pct(0.25), "p75": pct(0.75), "games": total,
            "buckets": [{"time": int(b["time"]), "games": b["games"], "wins": b["wins"]} for b in buckets]}


def pick_key_items(purchases) -> list[dict]:
    """Первые покупки самых дорогих предметов (от KEY_COST), не больше MAX_ITEMS, по порядку времени."""
    seen: set[str] = set()
    firsts = []
    for p in sorted((x for x in purchases or [] if x.get("time") is not None and x["time"] >= 0 and (x.get("cost") or 0) >= KEY_COST),
                    key=lambda x: x["time"]):
        if p["key"] not in seen:
            seen.add(p["key"])
            firsts.append(p)
    top = sorted(firsts, key=lambda x: -(x["cost"] or 0))[:MAX_ITEMS]
    return sorted(top, key=lambda x: x["time"])


def timed_item(p: dict, bench: dict | None) -> dict:
    out = {"key": p["key"], "name": p["name"], "img": p.get("img"), "cost": p.get("cost"), "time": int(p["time"]),
           "median": None, "p25": None, "p75": None, "delta": None, "games": None, "here_wr": None, "here_games": None}
    if bench:
        near = min(bench["buckets"], key=lambda b: abs(b["time"] - p["time"]))
        out |= {"median": bench["median"], "p25": bench["p25"], "p75": bench["p75"], "games": bench["games"],
                "delta": int(p["time"]) - bench["median"]}
        if near["games"] >= 20:
            out |= {"here_wr": round(near["wins"] / near["games"] * 100, 1), "here_games": near["games"]}
    return out


def assemble(items_players: list[dict], hero_by_slot: dict[int, int | None], bench: dict) -> tuple[list[dict], list[str]]:
    """bench: (hero_id, item_key) -> summarize_timings(...) или None."""
    players = []
    for pl in items_players:
        timed = [timed_item(p, bench.get((hero_by_slot.get(pl["slot"]), p["key"]))) for p in pick_key_items(pl.get("purchases"))]
        deltas = [t["delta"] for t in timed if t["delta"] is not None]
        players.append({k: pl[k] for k in ("slot", "is_radiant", "hero_name", "hero_img", "name", "account_id")}
                       | {"items": timed, "avg_delta": round(sum(deltas) / len(deltas)) if deltas else None})
    return players, _highlights(players)


def _highlights(players: list[dict]) -> list[str]:
    flat = [(pl, it) for pl in players for it in pl["items"] if it["delta"] is not None]
    out: list[str] = []
    if flat:
        pl, it = min(flat, key=lambda x: x[1]["delta"])
        if it["delta"] <= -EVEN:
            out.append(f"Самая быстрая покупка: {pl['hero_name']} — {it['name']} на {clock(it['time'])}, на {clock(-it['delta'])} раньше обычного.")
        pl, it = max(flat, key=lambda x: x[1]["delta"])
        if it["delta"] >= EVEN:
            out.append(f"Самая поздняя покупка: {pl['hero_name']} — {it['name']} на {clock(it['time'])}, на {clock(it['delta'])} позже обычного.")
    avg = {}
    for side in (True, False):
        ds = [pl["avg_delta"] for pl in players if pl["is_radiant"] == side and pl["avg_delta"] is not None]
        avg[side] = sum(ds) / len(ds) if ds else None
    if avg[True] is not None and avg[False] is not None and abs(avg[True] - avg[False]) >= EVEN:
        fast = "radiant" if avg[True] < avg[False] else "dire"
        out.append(f"Ключевые предметы быстрее покупала команда {SIDE_RU[fast]}: в среднем на {clock(abs(avg[True] - avg[False]))} раньше соперника.")
    if not out and flat:
        out.append("Темп покупок ключевых предметов близок к обычному.")
    return out
