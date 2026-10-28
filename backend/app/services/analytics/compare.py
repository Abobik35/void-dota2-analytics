def tally(rows: list[dict]) -> dict[int, list[int]]:
    """hero_id -> [матчи, победы] по выборке."""
    out: dict[int, list[int]] = {}
    for r in rows:
        g = out.setdefault(r["hero_id"], [0, 0])
        g[0] += 1
        g[1] += 1 if r["won"] else 0
    return out


def _side(games: int, wins: int) -> dict:
    return {"games": games, "wins": wins, "win_rate": round(wins / games * 100, 1)}


def common_heroes(rows_a: list[dict], rows_b: list[dict], limit: int = 8) -> list[dict]:
    """Герои, на которых играли оба игрока; сначала те, где у обоих больше матчей."""
    ta, tb = tally(rows_a), tally(rows_b)
    ids = [h for h in ta if h in tb and h != 0]
    ids.sort(key=lambda h: (min(ta[h][0], tb[h][0]), ta[h][0] + tb[h][0]), reverse=True)
    return [{"hero_id": h, "a": _side(*ta[h]), "b": _side(*tb[h])} for h in ids[:limit]]


def sample_warnings(na: int, nb: int) -> list[str]:
    out: list[str] = []
    if min(na, nb) == 0:
        out.append("У одного из игроков в выборке нет матчей: сравнивать нечего.")
    elif min(na, nb) < 20:
        out.append(f"В одной из выборок меньше 20 матчей ({na} и {nb}): выводы ненадёжны.")
    if max(na, nb) and min(na, nb) and abs(na - nb) / max(na, nb) > 0.2:
        out.append(f"Выборки разного размера: {na} и {nb} матчей. Сравнивайте осторожно.")
    return out
