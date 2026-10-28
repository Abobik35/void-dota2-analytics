"""Разбор ошибок по данным реплея. Всё считается по фиксированным правилам из логов OpenDota, без догадок об «умысле» игрока."""
from collections import defaultdict

from app.services.opendota.flow import clock

LIMITATIONS = [
    "Это наблюдения по данным реплея, а не приговор: у каждого правила есть исключения (разменялись осознанно, забрали Рошана, ушли за картой).",
    "Смерти восстанавливаются из логов убийств противников, поэтому часть смертей (например, от крипов) может не попасть в список.",
    "«Вне командного боя» значит, что смерть не попала во временное окно боя, найденного OpenDota. Позиции отдельных смертей и вижн в момент смерти в данных недоступны.",
    "Простой в фарме определяется по приросту золота относительно обычного для самого игрока, поэтому время смерти и перемещений тоже попадает в простой.",
    "Данные есть только у обработанных матчей.",
]
FIGHT_PAD = 5          # запас по времени вокруг окна боя, сек
STREAK_WINDOW = 180    # три смерти за это время — серия
BUYBACK_WINDOW = 60    # смерть после бай-бэка за это время — бай-бэк «сгорел»


def idle_stretches(gold_t, factor: float = 0.35, min_len: int = 3, start_min: int = 8) -> list[tuple[int, int, int]]:
    """Отрезки (начало, конец, минут) подряд идущих минут, когда прирост золота < factor от обычного для игрока."""
    if not isinstance(gold_t, list) or len(gold_t) < 14 or not all(isinstance(v, (int, float)) for v in gold_t):
        return []
    deltas = [gold_t[i] - gold_t[i - 1] for i in range(1, len(gold_t))]
    if sum(1 for d in deltas if d < 0) > 0.2 * len(deltas):  # ряд не накопительный — доверять нельзя
        return []
    sample = sorted(d for d in deltas[4:] if d >= 0)
    if len(sample) < 8:
        return []
    median = sample[len(sample) // 2]
    if median <= 0:
        return []
    last = len(gold_t) - 3  # последние минуты — конец игры, не считаем
    low = [i for i, d in enumerate(deltas, start=1) if start_min <= i <= last and d < factor * median]
    runs: list[list[int]] = []
    for i in low:
        if runs and i == runs[-1][-1] + 1:
            runs[-1].append(i)
        else:
            runs.append([i])
    return [((r[0] - 1) * 60, r[-1] * 60, len(r)) for r in runs if len(r) >= min_len]


def build_mistakes(raw: dict, heroes: dict[int, dict], meta: dict[int, dict]) -> dict:
    players = raw.get("players") or []
    fights = raw.get("teamfights") or []
    if not (any(p.get("kills_log") for p in players) or fights):
        return {"available": False, "reason": "OpenDota ещё не обработал реплей: разбирать ошибки не по чему.",
                "highlights": [], "players": [], "limitations": LIMITATIONS}

    hero_of = lambda p: heroes.get(p.get("hero_id")) or {}  # noqa: E731
    idx_by_key = {hero_of(p).get("name"): i for i, p in enumerate(players) if hero_of(p).get("name")}
    hname = lambda i: hero_of(players[i]).get("localized_name", "Герой")  # noqa: E731

    deaths: dict[int, list[tuple[int, int]]] = defaultdict(list)  # жертва -> [(время, убийца)]
    for killer, p in enumerate(players):
        for k in p.get("kills_log") or []:
            victim, t = idx_by_key.get(k.get("key")), k.get("time")
            if victim is not None and t is not None:
                deaths[victim].append((t, killer))
    for lst in deaths.values():
        lst.sort()

    windows = [(f["start"] - FIGHT_PAD, f["end"] + FIGHT_PAD) for f in fights if f.get("start") is not None and f.get("end") is not None]
    in_fight = lambda t: any(a <= t <= b for a, b in windows)  # noqa: E731
    first_deaths: dict[int, int] = defaultdict(int)
    for a, b in windows:
        inside = [(t, v) for v, lst in deaths.items() for t, _ in lst if a <= t <= b]
        if len(inside) >= 2:
            first_deaths[min(inside)[1]] += 1

    out = []
    for i, p in enumerate(players):
        slot = p.get("player_slot", 0)
        m = meta.get(slot, {})
        my = deaths.get(i, [])
        findings: list[dict] = []

        solo = [(t, k) for t, k in my if not in_fight(t)]
        for t, k in solo[:6]:
            findings.append({"time": t, "kind": "solo_death", "severity": "info",
                             "text": f"Погиб вне командного боя на {clock(t)} (убил {hname(k)})."})

        j = 0
        while j + 2 < len(my):
            if my[j + 2][0] - my[j][0] <= STREAK_WINDOW:
                findings.append({"time": my[j][0], "kind": "death_streak", "severity": "warn",
                                 "text": f"Три смерти за {STREAK_WINDOW // 60} минуты: с {clock(my[j][0])} по {clock(my[j + 2][0])}."})
                j += 3
            else:
                j += 1

        fd = first_deaths.get(i, 0)
        if fd >= 2:
            findings.append({"time": None, "kind": "first_death", "severity": "warn",
                             "text": f"Первым погибал в {fd} командных боях."})

        buybacks = [b["time"] for b in (p.get("buyback_log") or []) if b.get("time") is not None]
        wasted = [t for t in buybacks if any(0 < dt - t <= BUYBACK_WINDOW for dt, _ in my)]
        for t in wasted:
            findings.append({"time": t, "kind": "buyback_wasted", "severity": "warn",
                             "text": f"Бай-бэк на {clock(t)}, и в течение минуты погиб снова."})

        idle = idle_stretches(p.get("gold_t"))
        for s, e, n in idle:
            findings.append({"time": s, "kind": "idle_farm", "severity": "warn" if n >= 5 else "info",
                             "text": f"Простой в фарме {clock(s)}–{clock(e)} ({n} мин): прирост золота заметно ниже обычного для этого игрока."})

        lane = p.get("lane_efficiency_pct")
        if lane is None and isinstance(p.get("lane_efficiency"), (int, float)):
            lane = p["lane_efficiency"] * 100
        findings.sort(key=lambda f: (f["time"] is None, f["time"] or 0))
        out.append({
            "slot": slot, "is_radiant": slot < 128, "hero_name": m.get("hero_name") or hname(i),
            "hero_img": m.get("hero_img"), "name": m.get("name"), "account_id": m.get("account_id"),
            "stats": {"deaths": p.get("deaths"), "deaths_known": len(my), "solo_deaths": len(solo),
                      "early_deaths": sum(1 for t, _ in my if t < 600), "first_deaths": fd, "buybacks": len(buybacks),
                      "buybacks_wasted": len(wasted), "idle_minutes": sum(n for _, _, n in idle),
                      "lane_pct": round(lane) if isinstance(lane, (int, float)) else None},
            "findings": findings,
        })

    def top(stat: str, minimum: int, text) -> str | None:
        best = max(out, key=lambda x: x["stats"][stat], default=None)
        return text(best, best["stats"][stat]) if best and best["stats"][stat] >= minimum else None

    wasted_total = sum(x["stats"]["buybacks_wasted"] for x in out)
    highlights = [h for h in [
        top("solo_deaths", 2, lambda b, n: f"Больше всего смертей вне командных боёв: {b['hero_name']} ({n})."),
        top("first_deaths", 2, lambda b, n: f"Чаще всех первым погибал в боях: {b['hero_name']} ({n})."),
        top("idle_minutes", 3, lambda b, n: f"Дольше всех простаивал в фарме: {b['hero_name']} (≈{n} мин)."),
        f"Бай-бэков, после которых игрок быстро погиб снова: {wasted_total}." if wasted_total else None,
    ] if h]
    if not highlights:
        highlights = ["Явных ошибок по данным реплея не найдено."]
    return {"available": True, "reason": None, "highlights": highlights, "players": out, "limitations": LIMITATIONS}
