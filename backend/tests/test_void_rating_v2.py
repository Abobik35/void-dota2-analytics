from app.services.analytics.benchmarks import parse_benchmarks, percentile_of
from app.services.analytics.void_extras import extract_extras
from app.services.analytics.void_rating import compute_void_rating
from app.services.opendota.normalizer import normalize_match

PTS = [(0.1, 300), (0.25, 350), (0.5, 420), (0.75, 500), (0.9, 580), (0.99, 700)]


def test_percentile_of():
    assert abs(percentile_of(420, PTS) - 0.5) < 1e-9
    assert 0.5 < percentile_of(460, PTS) < 0.75
    assert 0 < percentile_of(150, PTS) < 0.1
    assert percentile_of(900, PTS) > 0.99 and percentile_of(900, PTS) <= 1.0
    assert percentile_of(5, [(0.1, 0), (0.5, 0), (0.9, 0)]) is None  # бенчмарк без информации (лечение у не-лекаря)
    assert percentile_of(5, None) is None
    assert percentile_of(10, [(0.1, 10), (0.5, 10), (0.9, 10), (0.99, 12)]) is not None


def test_parse_benchmarks():
    raw = {"hero_id": 1, "result": {"gold_per_min": [{"percentile": 0.1, "value": 300}, {"percentile": 0.5, "value": 420}, {"percentile": 0.9, "value": 580}],
                                    "xp_per_min": [{"percentile": 0.5, "value": 1}]}}
    b = parse_benchmarks(raw)
    assert list(b) == ["gold_per_min"] and b["gold_per_min"][1] == (0.5, 420.0)
    assert parse_benchmarks({"result": None}) is None and parse_benchmarks("x") is None


def _raw(extra_players=None, parsed=True):
    players = []
    for i in range(10):
        n = i % 5
        p = {"player_slot": n if i < 5 else 128 + n, "hero_id": 1 + i, "kills": 9 - n, "deaths": 2 + n, "assists": 4 + 3 * n,
             "gold_per_min": 600 - 90 * n, "xp_per_min": 650 - 80 * n, "last_hits": 300 - 55 * n, "denies": 4,
             "hero_damage": 25000 - 4000 * n, "tower_damage": 3000 - 500 * n, "hero_healing": 200 * n, "net_worth": 22000 - 3500 * n}
        if parsed:
            p |= {"lane_role": [2, 1, 3, 1, 3][n], "obs_placed": n * 3, "sen_placed": n * 2, "stuns": 5.0 * n, "camps_stacked": n,
                  "teamfight_participation": 0.9 - 0.1 * n}
        players.append(p)
    return {"match_id": 1, "duration": 1800, "radiant_win": True, "players": players}


def _match(raw):
    heroes = {h: {"id": h, "name": f"npc_dota_hero_h{h}", "localized_name": f"H{h}"} for h in range(1, 11)}
    return normalize_match(raw, heroes), heroes


def test_v2_roles_positions_utility_and_contributions():
    raw = _raw()
    m, heroes = _match(raw)
    r = compute_void_rating(m, extract_extras(raw, heroes), {})
    assert r.version == "v2" and r.available
    by = {p.slot: p for p in r.players}
    assert by[0].role == "core" and by[0].position == 2           # мид по lane_role
    assert by[1].role == "core" and by[1].position == 1 and by[2].role == "core" and by[2].position == 3
    assert by[3].role == "support" and by[3].position == 4 and by[4].role == "support" and by[4].position == 5
    assert all(p.categories["utility"] is not None for p in r.players)
    for p in r.players:
        assert abs(sum(c.points for c in p.contributions) - (p.rating - 50)) < 0.2  # вклады раскладывают рейтинг без остатка
        assert 0 <= p.confidence <= 1 and p.margin >= 2


def test_benchmarks_and_extras_raise_confidence():
    raw = _raw()
    m, heroes = _match(raw)
    plain = compute_void_rating(m)
    bench = {h: {"gold_per_min": PTS, "xp_per_min": PTS, "last_hits_per_min": [(0.1, 3), (0.5, 6), (0.9, 9)],
                 "hero_damage_per_min": [(0.1, 300), (0.5, 600), (0.9, 900)], "kills_per_min": [(0.1, .1), (0.5, .25), (0.9, .5)]}
             for h in range(1, 11)}
    full = compute_void_rating(m, extract_extras(raw, heroes), bench)
    assert min(p.confidence for p in full.players) > max(p.confidence for p in plain.players)
    top = full.players[0]
    assert any("процентиль героя" in t for t in top.positives + top.negatives) or any("процентиль" in c.detail for c in top.contributions)


def test_late_and_solo_deaths_cost_more():
    raw = _raw()
    heroes = {h: {"id": h, "name": f"npc_dota_hero_h{h}", "localized_name": f"H{h}"} for h in range(1, 11)}
    # игрок h6 (slot 128) убивает h1 (slot 0) дважды: рано в бою и поздно в одиночку
    raw["players"][5]["kills_log"] = [{"time": 300, "key": "npc_dota_hero_h1"}, {"time": 2400, "key": "npc_dota_hero_h1"}]
    raw["teamfights"] = [{"start": 290, "end": 320}]
    ex = extract_extras(raw, heroes)
    assert ex[0]["avg_death_weight"] > 1.5 and "avg_death_weight" not in ex[1]


def test_unparsed_still_works_like_v1():
    raw = _raw(parsed=False)
    m, _ = _match(raw)
    r = compute_void_rating(m)
    assert r.available and all(p.categories["utility"] is None for p in r.players)
    assert sum(p.role == "core" for p in r.players) == 6 and r.mvp.basis == "void_rating"
