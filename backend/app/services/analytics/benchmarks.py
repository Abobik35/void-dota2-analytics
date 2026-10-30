"""Бенчмарки героев OpenDota (/benchmarks?hero_id=): перевод значения в процентиль героя."""

BENCH_KEYS = {
    "hero_damage_pm": "hero_damage_per_min", "kills_pm": "kills_per_min", "gpm": "gold_per_min",
    "xpm": "xp_per_min", "last_hits_pm": "last_hits_per_min", "healing_pm": "hero_healing_per_min",
}


def _num(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def parse_benchmarks(raw) -> dict[str, list[tuple[float, float]]] | None:
    res = raw.get("result") if isinstance(raw, dict) else None
    if not isinstance(res, dict):
        return None
    out: dict[str, list[tuple[float, float]]] = {}
    for key in BENCH_KEYS.values():
        pts = []
        for e in res.get(key) or []:
            if isinstance(e, dict):
                p, v = _num(e.get("percentile")), _num(e.get("value"))
                if p is not None and v is not None:
                    pts.append((p, v))
        pts.sort()
        if len(pts) >= 3:
            out[key] = pts
    return out or None


def percentile_of(value: float, pts: list[tuple[float, float]] | None) -> float | None:
    """Процентиль 0..1 по точкам (процентиль, значение). None, если бенчмарк бесполезен (например, лечение у не-лекаря)."""
    if not pts or max(v for _, v in pts) <= 0:
        return None
    if value <= pts[0][1]:
        return 0.0 if pts[0][1] <= 0 else pts[0][0] * max(value, 0.0) / pts[0][1]
    for (p0, v0), (p1, v1) in zip(pts, pts[1:]):
        if value <= v1:
            return (p0 + p1) / 2 if v1 == v0 else p0 + (p1 - p0) * (value - v0) / (v1 - v0)
    p, v = pts[-1]
    return min(1.0, p + (1 - p) * min(1.0, (value - v) / v)) if v > 0 else 1.0
