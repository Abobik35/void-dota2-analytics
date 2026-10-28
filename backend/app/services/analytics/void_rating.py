"""VOID Rating v1 — эвристическая оценка вклада игрока в матч. Формулы: docs/void-rating.md."""
from statistics import mean, pstdev

from app.schemas.match import MatchOut, PlayerOut
from app.schemas.void_rating import Mvp, RatedPlayer, VoidRatingOut

VERSION = "v1"
CATEGORIES = {"combat": "Бой", "economy": "Экономика", "participation": "Командная игра", "objectives": "Здания"}
ROLE_WEIGHTS = {
    "core": {"combat": .35, "economy": .30, "participation": .20, "objectives": .15},
    "support": {"combat": .20, "economy": .10, "participation": .50, "objectives": .20},
    "unknown": {"combat": .30, "economy": .25, "participation": .30, "objectives": .15},
}
# ключ: (категория, вес внутри категории, название, инвертировать)
METRICS = {
    "hero_damage_pm": ("combat", .5, "Урон по героям в минуту", False),
    "kills_pm": ("combat", .2, "Убийства в минуту", False),
    "deaths_pm": ("combat", .3, "Смерти в минуту", True),
    "gpm": ("economy", .5, "GPM", False),
    "xpm": ("economy", .3, "XPM", False),
    "last_hits_pm": ("economy", .2, "Добитые крипы в минуту", False),
    "kill_participation": ("participation", .6, "Участие в убийствах команды", False),
    "assists_pm": ("participation", .2, "Помощь в минуту", False),
    "healing_pm": ("participation", .2, "Лечение в минуту", False),
    "tower_damage_pm": ("objectives", 1.0, "Урон по зданиям в минуту", False),
}
LIMITATIONS = [
    "Это эвристическая оценка VOID, а не официальный рейтинг Valve и не точная мера мастерства.",
    "Роли определяются по net worth внутри команды: трое лидеров — core, остальные двое — support.",
    "Игрок сравнивается с участниками того же матча и той же роли, а не со всей базой игроков.",
    "Нет данных о вардах, станах, видении и позициях: полезность оценивается только по помощи и лечению.",
]


def _clamp(x: float) -> float:
    return max(0.0, min(100.0, x))


def _roles(players: list[PlayerOut]) -> dict[int, str]:
    out: dict[int, str] = {}
    for side in (True, False):
        team = [p for p in players if p.is_radiant == side]
        key = lambda p: p.net_worth if p.net_worth is not None else p.gpm  # noqa: E731
        if len(team) == 5 and all(key(p) is not None for p in team):
            for i, p in enumerate(sorted(team, key=key, reverse=True)):
                out[p.slot] = "core" if i < 3 else "support"
        else:
            out.update({p.slot: "unknown" for p in team})
    return out


def _raw(p: PlayerOut, mins: float, team_kills: int) -> dict[str, float | None]:
    per = lambda v: None if v is None else v / mins  # noqa: E731
    return {
        "hero_damage_pm": per(p.hero_damage), "kills_pm": p.kills / mins, "deaths_pm": p.deaths / mins,
        "gpm": p.gpm, "xpm": p.xpm, "last_hits_pm": per(p.last_hits),
        "kill_participation": (p.kills + p.assists) / team_kills if team_kills > 0 else None,
        "assists_pm": p.assists / mins, "healing_pm": per(p.hero_healing),
        "tower_damage_pm": per(p.tower_damage),
    }


def _fmt(key: str, v: float) -> str:
    if key == "kill_participation":
        return f"{v * 100:.0f}%"
    return f"{v:.2f}" if abs(v) < 10 else f"{v:.0f}"


def _kda_mvp(m: MatchOut) -> Mvp | None:
    pool = [p for p in m.players if m.radiant_win is None or p.is_radiant == m.radiant_win]
    if not pool:
        return None
    b = max(pool, key=lambda p: (p.kda, p.kills))
    return Mvp(slot=b.slot, account_id=b.account_id, name=b.name, hero_name=b.hero_name, hero_img=b.hero_img,
               rating=None, basis="kda", reasons=[f"Лучший KDA среди победителей: {b.kda:.2f} (рейтинг VOID недоступен)"])


def compute_void_rating(m: MatchOut) -> VoidRatingOut:
    mins = (m.duration or 0) / 60
    if len(m.players) < 6 or mins < 2:
        return VoidRatingOut(version=VERSION, available=False, mvp=_kda_mvp(m), players=[], limitations=LIMITATIONS,
                             reason="Недостаточно данных для рейтинга: нет длительности матча или список игроков неполный.")
    roles = _roles(m.players)
    kills = {side: sum(p.kills for p in m.players if p.is_radiant == side) for side in (True, False)}
    raws = {p.slot: _raw(p, mins, kills[p.is_radiant]) for p in m.players}

    stats: dict[tuple[str, str], tuple[float, float]] = {}
    for role in set(roles.values()):
        group = [p for p in m.players if roles[p.slot] == role]
        for key in METRICS:
            vals = [raws[p.slot][key] for p in group if raws[p.slot][key] is not None]
            if len(vals) >= 3:
                stats[(role, key)] = (mean(vals), pstdev(vals))

    rated: list[RatedPlayer] = []
    for p in m.players:
        role = roles[p.slot]
        cat_scores: dict[str, list[tuple[float, float]]] = {c: [] for c in CATEGORIES}
        notes: list[tuple[float, str]] = []
        used = 0
        for key, (cat, w, label, inverted) in METRICS.items():
            v, st = raws[p.slot][key], stats.get((role, key))
            if v is None or st is None:
                continue
            used += 1
            z = 0.0 if st[1] == 0 else (v - st[0]) / st[1]
            z = -z if inverted else z
            cat_scores[cat].append((_clamp(50 + 20 * z), w))
            notes.append((z, f"{label}: {_fmt(key, v)} (в среднем для роли {_fmt(key, st[0])})"))
        cats = {c: (round(sum(s * w for s, w in lst) / sum(w for _, w in lst), 1) if lst else None)
                for c, lst in cat_scores.items()}
        present = {c: ROLE_WEIGHTS[role][c] for c, v in cats.items() if v is not None}
        if not present:
            continue
        total = sum(cats[c] * w for c, w in present.items()) / sum(present.values())
        notes.sort(key=lambda t: t[0])
        rated.append(RatedPlayer(
            slot=p.slot, is_radiant=p.is_radiant, account_id=p.account_id, name=p.name, hero_name=p.hero_name,
            hero_img=p.hero_img, role=role, rating=round(total, 1), categories=cats,
            completeness=round(used / len(METRICS), 2),
            positives=[t for z, t in reversed(notes) if z >= .5][:3], negatives=[t for z, t in notes if z <= -.5][:3],
        ))
    rated.sort(key=lambda r: r.rating, reverse=True)
    if not rated:
        return VoidRatingOut(version=VERSION, available=False, mvp=_kda_mvp(m), players=[], limitations=LIMITATIONS,
                             reason="Недостаточно данных для расчёта.")
    pool = [r for r in rated if m.radiant_win is None or r.is_radiant == m.radiant_win] or rated
    b = pool[0]
    mvp = Mvp(slot=b.slot, account_id=b.account_id, name=b.name, hero_name=b.hero_name, hero_img=b.hero_img,
              rating=b.rating, basis="void_rating",
              reasons=b.positives or ["Наивысший VOID Rating среди победителей матча."])
    return VoidRatingOut(version=VERSION, available=True, mvp=mvp, players=rated, limitations=LIMITATIONS)
