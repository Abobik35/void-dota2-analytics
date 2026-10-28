from app.services.analytics.void_rating import compute_void_rating
from app.services.opendota.normalizer import normalize_match


def _match(duration=1800, radiant_win=True, drop_optional=False):
    players = []
    for i in range(10):
        radiant = i < 5
        n = i % 5  # 0 — самый богатый в команде
        p = {"player_slot": n if radiant else 128 + n, "hero_id": 1, "kills": 10 - 2 * n + (3 if radiant else 0),
             "deaths": 2 + n, "assists": 4 + 3 * n, "gold_per_min": 600 - 90 * n, "xp_per_min": 650 - 80 * n,
             "last_hits": 300 - 55 * n, "denies": 5, "hero_damage": 25000 - 4000 * n, "tower_damage": 3000 - 500 * n,
             "hero_healing": 200 * n, "net_worth": 22000 - 3500 * n}
        if drop_optional:
            for k in ("hero_damage", "tower_damage", "hero_healing", "last_hits", "xp_per_min"):
                p.pop(k)
        players.append(p)
    return normalize_match({"match_id": 1, "duration": duration, "radiant_win": radiant_win, "players": players}, {})


def test_ratings_in_range_and_roles():
    r = compute_void_rating(_match())
    assert r.available and len(r.players) == 10
    assert all(0 <= p.rating <= 100 for p in r.players)
    assert sum(p.role == "core" for p in r.players) == 6 and sum(p.role == "support" for p in r.players) == 4
    assert r.players == sorted(r.players, key=lambda p: p.rating, reverse=True)


def test_mvp_from_winners():
    r = compute_void_rating(_match(radiant_win=False))
    assert r.mvp and r.mvp.basis == "void_rating"
    assert not next(p for p in r.players if p.slot == r.mvp.slot).is_radiant


def test_missing_data_lowers_completeness_not_crashes():
    r = compute_void_rating(_match(drop_optional=True))
    assert r.available and all(p.completeness < 1 for p in r.players)


def test_unavailable_without_duration_uses_kda_fallback():
    r = compute_void_rating(_match(duration=None))
    assert not r.available and r.mvp and r.mvp.basis == "kda" and r.mvp.rating is None
