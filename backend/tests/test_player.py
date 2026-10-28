from app.services.analytics.player import aggregate
from app.services.opendota.players import matches_path, normalize_row


def test_normalize_row_won_by_side():
    base = {"match_id": 1, "hero_id": 5, "kills": 2, "deaths": 0, "assists": 4}
    assert normalize_row({**base, "player_slot": 0, "radiant_win": True})["won"] is True
    assert normalize_row({**base, "player_slot": 130, "radiant_win": True})["won"] is False
    assert normalize_row({**base, "player_slot": 130, "radiant_win": False})["won"] is True
    assert normalize_row(base)["won"] is None
    r = normalize_row({**base, "player_slot": 0, "radiant_win": True}, {"gold_per_min": 500})
    assert r["gpm"] == 500 and r["kda"] == 6.0


def test_aggregate_sample():
    rows = [
        {"match_id": 3, "hero_id": 1, "won": True, "kills": 10, "deaths": 2, "assists": 6, "gpm": 600, "xpm": 700},
        {"match_id": 2, "hero_id": 1, "won": False, "kills": 2, "deaths": 8, "assists": 4, "gpm": None, "xpm": None},
        {"match_id": 1, "hero_id": 2, "won": None, "kills": 0, "deaths": 0, "assists": 0, "gpm": 400, "xpm": 500},
    ]
    a = aggregate(rows)
    assert (a["sample_size"], a["wins"], a["losses"], a["win_rate"]) == (3, 1, 1, 50.0)
    assert a["kda"] == 2.2 and a["avg_gpm"] == 500 and a["gpm_sample"] == 2
    assert a["top_heroes"][0] == {"hero_id": 1, "games": 2, "wins": 1, "win_rate": 50.0}
    assert aggregate([])["win_rate"] is None


def test_matches_path_filters():
    assert matches_path(7, 20, 0) == "/players/7/matches?limit=20&offset=0"
    assert "date=30" in matches_path(7, 20, 0, days=30) and "hero_id=5" in matches_path(7, 20, 0, hero_id=5)
