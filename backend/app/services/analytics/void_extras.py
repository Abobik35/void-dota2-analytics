"""Дополнительные данные реплея для VOID Rating: линия, варды, станы, стаки, время и контекст смертей."""
from collections import defaultdict

DEATH_LATE_SCALE = 2400  # к 40-й минуте смерть «дороже» вдвое
SOLO_FACTOR = 1.25       # смерть вне командного боя дороже


def extract_extras(raw: dict, heroes: dict[int, dict]) -> dict[int, dict]:
    players = raw.get("players") or []
    key_of = lambda p: (heroes.get(p.get("hero_id")) or {}).get("name")  # noqa: E731
    idx = {key_of(p): i for i, p in enumerate(players) if key_of(p)}
    deaths: dict[int, list[int]] = defaultdict(list)
    for p in players:
        for k in p.get("kills_log") or []:
            v, t = idx.get(k.get("key")), k.get("time")
            if v is not None and t is not None:
                deaths[v].append(t)
    fights = [(f["start"] - 5, f["end"] + 5) for f in raw.get("teamfights") or []
              if f.get("start") is not None and f.get("end") is not None]
    out: dict[int, dict] = {}
    for i, p in enumerate(players):
        ex = {k: p.get(k) for k in ("lane_role", "obs_placed", "sen_placed", "observer_kills", "sentry_kills", "camps_stacked", "stuns")}
        ex["tf_part"] = p.get("teamfight_participation")
        ts = deaths.get(i)
        if ts:
            ws = [(1 + min(1.0, max(t, 0) / DEATH_LATE_SCALE)) * (SOLO_FACTOR if fights and not any(a <= t <= b for a, b in fights) else 1.0)
                  for t in ts]
            ex["avg_death_weight"] = sum(ws) / len(ws)
        out[p.get("player_slot", 0)] = ex
    return out
