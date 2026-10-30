"""VOID Rating v2 — эвристическая оценка вклада игрока в матч. Формулы: docs/void-rating.md.

Что нового по сравнению с v1: сравнение с нормой героя (бенчмарки OpenDota), роль и позиция с учётом линий,
категория «Польза» (варды, станы, стаки), штраф за смерти с учётом времени и контекста, доверие и вклад каждого показателя в очках.
"""
from statistics import mean, pstdev

from app.schemas.match import MatchOut, PlayerOut
from app.schemas.void_rating import Contribution, Mvp, RatedPlayer, VoidRatingOut
from app.services.analytics.benchmarks import BENCH_KEYS, percentile_of

VERSION = "v2"
BENCH_WEIGHT = 0.6  # доля нормы героя в оценке показателя, если бенчмарк есть
CATEGORIES = {"combat": "Бой", "economy": "Экономика", "participation": "Команда", "objectives": "Здания", "utility": "Польза"}
ROLE_WEIGHTS = {
    "core": {"combat": .35, "economy": .30, "participation": .17, "objectives": .13, "utility": .05},
    "support": {"combat": .18, "economy": .08, "participation": .39, "objectives": .15, "utility": .20},
    "unknown": {"combat": .30, "economy": .24, "participation": .26, "objectives": .12, "utility": .08},
}
# ключ: (категория, вес внутри категории, название, инвертировать)
METRICS = {
    "hero_damage_pm": ("combat", .45, "Урон по героям в минуту", False),
    "kills_pm": ("combat", .20, "Убийства в минуту", False),
    "deaths_cost_pm": ("combat", .35, "Смерти в минуту (с учётом времени и контекста)", True),
    "gpm": ("economy", .45, "GPM", False),
    "xpm": ("economy", .30, "XPM", False),
    "last_hits_pm": ("economy", .25, "Добитые крипы в минуту", False),
    "kill_participation": ("participation", .50, "Участие в убийствах команды", False),
    "assists_pm": ("participation", .20, "Помощь в минуту", False),
    "healing_pm": ("participation", .15, "Лечение в минуту", False),
    "tf_participation": ("participation", .15, "Участие в командных боях", False),
    "tower_damage_pm": ("objectives", 1.0, "Урон по зданиям в минуту", False),
    "vision_pm": ("utility", .40, "Варды в минуту", False),
    "dewards_pm": ("utility", .20, "Уничтожено вардов в минуту", False),
    "stuns_pm": ("utility", .25, "Секунд контроля в минуту", False),
    "stacks_pm": ("utility", .15, "Застакано лагерей в минуту", False),
}
PERCENT_KEYS = {"kill_participation", "tf_participation"}
POINTS_MIN = 0.6  # вклад меньше этого не считается заметным
LIMITATIONS = [
    "Это эвристическая оценка VOID, а не официальный рейтинг Valve и не точная мера мастерства.",
    "Показатель сравнивается и с нормой героя (бенчмарки OpenDota, все звания), и с игроками той же роли в этом матче. Без бенчмарка — только с матчем.",
    "Роль и позиция определяются по богатству и, если есть данные реплея, по линии. Это оценка, а не знание о задуманной роли.",
    "Категория «Польза» (варды, станы, стаки) считается только для обработанных матчей. Видение и позиции в момент смертей недоступны.",
    "Смерть учитывается дороже, если она случилась поздно или вне командного боя. Точность этого штрафа ограничена логами убийств.",
    "Доверие и погрешность (±) зависят от полноты данных, наличия бенчмарка, числа игроков в сравнении и длительности матча.",
    "Веса подобраны разумно, но не калибровались на большой выборке реальных матчей.",
]


def _clamp(x: float) -> float:
    return max(0.0, min(100.0, x))


def _roles(players: list[PlayerOut], extras: dict[int, dict]) -> tuple[dict[int, str], dict[int, int | None]]:
    roles: dict[int, str] = {}
    pos: dict[int, int | None] = {}
    for side in (True, False):
        team = [p for p in players if p.is_radiant == side]
        key = lambda p: p.net_worth if p.net_worth is not None else p.gpm  # noqa: E731
        if len(team) != 5 or any(key(p) is None for p in team):
            for p in team:
                roles[p.slot], pos[p.slot] = "unknown", None
            continue
        order = sorted(team, key=key, reverse=True)
        lanes = {p.slot: (extras.get(p.slot) or {}).get("lane_role") for p in team}
        mids = [p for p in team if lanes[p.slot] == 2]
        have_lanes = all(v is not None for v in lanes.values())
        if have_lanes and len(mids) == 1:
            rest = [p for p in order if p is not mids[0]]
            cores, supports = [mids[0], rest[0], rest[1]], rest[2:]
        else:
            cores, supports = order[:3], order[3:]
        for p in cores:
            roles[p.slot] = "core"
        for p in supports:
            roles[p.slot] = "support"
        for p in team:
            pos[p.slot] = None
        if have_lanes and len(mids) == 1:
            pos[mids[0].slot] = 2
            for p in cores[1:]:
                pos[p.slot] = 1 if lanes[p.slot] == 1 else 3 if lanes[p.slot] == 3 else None
            for rank, p in enumerate(supports):
                pos[p.slot] = 4 + rank  # у кого богатство выше — позиция 4
    return roles, pos


def _raw(p: PlayerOut, mins: float, team_kills: int, ex: dict | None) -> dict[str, float | None]:
    ex = ex or {}
    per = lambda v: None if v is None else v / mins  # noqa: E731
    both = lambda a, b: None if a is None and b is None else ((a or 0) + (b or 0)) / mins  # noqa: E731
    tf = ex.get("tf_part")
    return {
        "hero_damage_pm": per(p.hero_damage), "kills_pm": p.kills / mins,
        "deaths_cost_pm": p.deaths * ex.get("avg_death_weight", 1.0) / mins,
        "gpm": p.gpm, "xpm": p.xpm, "last_hits_pm": per(p.last_hits),
        "kill_participation": (p.kills + p.assists) / team_kills if team_kills > 0 else None,
        "assists_pm": p.assists / mins, "healing_pm": per(p.hero_healing),
        "tf_participation": tf * 100 if isinstance(tf, (int, float)) else None,
        "tower_damage_pm": per(p.tower_damage),
        "vision_pm": both(ex.get("obs_placed"), ex.get("sen_placed")),
        "dewards_pm": both(ex.get("observer_kills"), ex.get("sentry_kills")),
        "stuns_pm": per(ex.get("stuns")), "stacks_pm": per(ex.get("camps_stacked")),
    }


def _fmt(key: str, v: float) -> str:
    if key in PERCENT_KEYS:
        return f"{v * 100:.0f}%" if key == "kill_participation" else f"{v:.0f}%"
    return f"{v:.2f}" if abs(v) < 10 else f"{v:.0f}"


def _kda_mvp(m: MatchOut) -> Mvp | None:
    pool = [p for p in m.players if m.radiant_win is None or p.is_radiant == m.radiant_win]
    if not pool:
        return None
    b = max(pool, key=lambda p: (p.kda, p.kills))
    return Mvp(slot=b.slot, account_id=b.account_id, name=b.name, hero_name=b.hero_name, hero_img=b.hero_img,
               rating=None, basis="kda", reasons=[f"Лучший KDA среди победителей: {b.kda:.2f} (рейтинг VOID недоступен)"])


def compute_void_rating(m: MatchOut, extras: dict[int, dict] | None = None,
                        bench: dict[int, dict[str, list[tuple[float, float]]]] | None = None) -> VoidRatingOut:
    extras, bench = extras or {}, bench or {}
    mins = (m.duration or 0) / 60
    if len(m.players) < 6 or mins < 2:
        return VoidRatingOut(version=VERSION, available=False, mvp=_kda_mvp(m), players=[], limitations=LIMITATIONS,
                             reason="Недостаточно данных для рейтинга: нет длительности матча или список игроков неполный.")
    roles, positions = _roles(m.players, extras)
    kills = {side: sum(p.kills for p in m.players if p.is_radiant == side) for side in (True, False)}
    raws = {p.slot: _raw(p, mins, kills[p.is_radiant], extras.get(p.slot)) for p in m.players}

    stats: dict[tuple[str, str], tuple[float, float]] = {}
    cohort_size: dict[str, int] = {}
    for role in set(roles.values()):
        group = [p for p in m.players if roles[p.slot] == role]
        cohort_size[role] = len(group)
        for key in METRICS:
            vals = [raws[p.slot][key] for p in group if raws[p.slot][key] is not None]
            if len(vals) >= 3:
                stats[(role, key)] = (mean(vals), pstdev(vals))

    rated: list[RatedPlayer] = []
    for p in m.players:
        role, ex = roles[p.slot], extras.get(p.slot)
        hb = bench.get(p.hero_id) or {}
        entries = []  # (ключ, категория, вес, название, значение, оценка 0..100, пояснение, был ли бенчмарк)
        for key, (cat, w, label, inverted) in METRICS.items():
            v, st = raws[p.slot][key], stats.get((role, key))
            if v is None:
                continue
            cohort = None
            if st:
                z = 0.0 if st[1] == 0 else (v - st[0]) / st[1]
                cohort = _clamp(50 + 20 * (-z if inverted else z))
            pct = percentile_of(v, hb.get(BENCH_KEYS[key])) if key in BENCH_KEYS else None
            bscore = pct * 100 if pct is not None else None
            if cohort is None and bscore is None:
                continue
            score = bscore if cohort is None else cohort if bscore is None else BENCH_WEIGHT * bscore + (1 - BENCH_WEIGHT) * cohort
            ctx = f"{round(pct * 100)}-й процентиль героя" if pct is not None else f"среднее для роли {_fmt(key, st[0])}" if st else ""
            entries.append((key, cat, w, label, v, score, ctx, pct is not None))
        if not entries:
            continue

        cat_w: dict[str, float] = {}
        for _, cat, w, *_ in entries:
            cat_w[cat] = cat_w.get(cat, 0.0) + w
        present = {c: ROLE_WEIGHTS[role][c] for c in cat_w}
        total_w = sum(present.values())
        cats: dict[str, float | None] = {c: None for c in CATEGORIES}
        for c in cat_w:
            cats[c] = round(sum(s * w for _, cc, w, _, _, s, _, _ in entries if cc == c) / cat_w[c], 1)
        contributions = []
        rating = 0.0
        for key, cat, w, label, v, score, ctx, _ in entries:
            eff = present[cat] / total_w * w / cat_w[cat]
            rating += eff * score
            contributions.append((eff * (score - 50), label, key, v, ctx))
        contributions.sort(key=lambda t: t[0], reverse=True)

        capable = [e for e in entries if e[0] in BENCH_KEYS]
        c_bench = (sum(1 for e in capable if e[7]) / len(capable)) if capable else 0.5
        conf = 0.35 * len(entries) / len(METRICS) + 0.30 * c_bench + 0.15 * min(1.0, cohort_size[role] / 4) + 0.20 * min(1.0, mins / 20)
        conf = round(max(0.0, min(1.0, conf)), 2)
        fact = lambda c: f"{c[1]}: {_fmt(c[2], c[3])}" + (f" — {c[4]}" if c[4] else "") + f" ({c[0]:+.1f})"  # noqa: E731
        rated.append(RatedPlayer(
            slot=p.slot, is_radiant=p.is_radiant, account_id=p.account_id, name=p.name, hero_name=p.hero_name,
            hero_img=p.hero_img, role=role, position=positions.get(p.slot), rating=round(rating, 1),
            margin=round(2 + 10 * (1 - conf), 1), confidence=conf, categories=cats,
            completeness=round(len(entries) / len(METRICS), 2),
            contributions=[Contribution(label=c[1], points=round(c[0], 2), detail=c[4]) for c in contributions],
            positives=[fact(c) for c in contributions if c[0] >= POINTS_MIN][:3],
            negatives=[fact(c) for c in reversed(contributions) if c[0] <= -POINTS_MIN][:3],
        ))
    rated.sort(key=lambda r: r.rating, reverse=True)
    if not rated:
        return VoidRatingOut(version=VERSION, available=False, mvp=_kda_mvp(m), players=[], limitations=LIMITATIONS,
                             reason="Недостаточно данных для расчёта.")
    pool = [r for r in rated if m.radiant_win is None or r.is_radiant == m.radiant_win] or rated
    b = pool[0]
    mvp = Mvp(slot=b.slot, account_id=b.account_id, name=b.name, hero_name=b.hero_name, hero_img=b.hero_img,
              rating=b.rating, basis="void_rating", reasons=b.positives or ["Наивысший VOID Rating среди победителей матча."])
    return VoidRatingOut(version=VERSION, available=True, mvp=mvp, players=rated, limitations=LIMITATIONS)
