def _avg(vals: list[float], nd: int = 1) -> float | None:
    return round(sum(vals) / len(vals), nd) if vals else None


def aggregate(rows: list[dict]) -> dict:
    """Агрегаты по выборке матчей (не по всей истории игрока). rows — результат normalize_row."""
    n = len(rows)
    known = [r for r in rows if r["won"] is not None]
    wins = sum(1 for r in known if r["won"])
    k, d, a = (sum(r[x] for r in rows) for x in ("kills", "deaths", "assists"))
    gpm = [r["gpm"] for r in rows if r.get("gpm") is not None]
    xpm = [r["xpm"] for r in rows if r.get("xpm") is not None]
    heroes: dict[int, list[int]] = {}
    for r in rows:
        g = heroes.setdefault(r["hero_id"], [0, 0])
        g[0] += 1
        g[1] += 1 if r["won"] else 0
    top = sorted(heroes.items(), key=lambda kv: (kv[1][0], kv[1][1]), reverse=True)[:8]
    return {
        "sample_size": n, "wins": wins, "losses": len(known) - wins,
        "win_rate": round(wins / len(known) * 100, 1) if known else None,
        "avg_kills": _avg([r["kills"] for r in rows]), "avg_deaths": _avg([r["deaths"] for r in rows]),
        "avg_assists": _avg([r["assists"] for r in rows]),
        "kda": round((k + a) / max(d, 1), 2) if n else None,
        "avg_gpm": round(sum(gpm) / len(gpm)) if gpm else None,
        "avg_xpm": round(sum(xpm) / len(xpm)) if xpm else None, "gpm_sample": len(gpm),
        "top_heroes": [{"hero_id": h, "games": g, "wins": w, "win_rate": round(w / g * 100, 1)} for h, (g, w) in top],
        "form": [{"match_id": r["match_id"], "won": r["won"]} for r in rows[:20]],
    }
