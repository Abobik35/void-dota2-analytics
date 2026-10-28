from app.services.analytics.team import team_analytics
from app.services.opendota.normalizer import normalize_match


def test_team_totals():
    raw = {"match_id": 1, "players": [
        {"player_slot": 0, "kills": 3, "deaths": 1, "assists": 2, "gold_per_min": 400, "net_worth": 100},
        {"player_slot": 1, "kills": 1, "deaths": 2, "assists": 0, "gold_per_min": 500, "net_worth": 50},
        {"player_slot": 128, "kills": 2, "deaths": 4, "assists": 1}]}
    t = team_analytics(normalize_match(raw, {}))
    assert t.radiant.kills == 4 and t.radiant.avg_gpm == 450 and t.radiant.net_worth == 150
    assert t.dire.avg_gpm is None and t.dire.net_worth is None
