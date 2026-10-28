from app.services.opendota.normalizer import index_heroes, normalize_match

HEROES = index_heroes([{"id": 1, "name": "npc_dota_hero_antimage", "localized_name": "Anti-Mage"}])


def test_normalize_basic_match():
    raw = {"match_id": 5, "radiant_win": True, "players": [
        {"player_slot": 0, "hero_id": 1, "kills": 10, "deaths": 0, "assists": 5},
        {"player_slot": 128, "hero_id": 999, "kills": 1, "deaths": 4, "assists": 2}]}
    m = normalize_match(raw, HEROES)
    assert m.data_status == "basic"
    assert m.players[0].is_radiant and m.players[0].kda == 15.0
    assert m.players[0].hero_name == "Anti-Mage"
    assert not m.players[1].is_radiant and m.players[1].hero_name == "Герой #999"
    assert m.players[1].gpm is None


def test_parsed_match_is_full():
    assert normalize_match({"match_id": 1, "version": 21, "players": []}, HEROES).data_status == "full"


def test_parsed_detected_by_gold_advantage_without_version():
    raw = {"match_id": 2, "radiant_gold_adv": [0, 100], "players": []}
    assert normalize_match(raw, HEROES).data_status == "full"
