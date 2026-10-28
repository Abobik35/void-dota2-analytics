from app.services.opendota.mistakes import build_mistakes, idle_stretches

HEROES = {1: {"id": 1, "name": "npc_dota_hero_antimage", "localized_name": "Anti-Mage"},
          2: {"id": 2, "name": "npc_dota_hero_axe", "localized_name": "Axe"},
          3: {"id": 3, "name": "npc_dota_hero_lion", "localized_name": "Lion"}}
META = {0: {"hero_name": "Anti-Mage"}, 128: {"hero_name": "Axe"}, 129: {"hero_name": "Lion"}}


def test_idle_stretches():
    gold = [0]
    for m in range(1, 25):
        gold.append(gold[-1] + (50 if 12 <= m <= 15 else 500))
    s = idle_stretches(gold)
    assert len(s) == 1 and s[0][2] == 4 and s[0][0] == 11 * 60
    assert idle_stretches([0, 100, 50, 300, 20, 400, 0, 500, 10, 600, 0, 700, 0, 800]) == []  # ряд не накопительный
    assert idle_stretches(None) == []


def test_deaths_streaks_first_deaths_and_buybacks():
    raw = {"teamfights": [{"start": 1000, "end": 1030, "deaths": 2, "players": []},
                          {"start": 2000, "end": 2030, "deaths": 2, "players": []}],
           "players": [
               {"player_slot": 0, "hero_id": 1, "deaths": 5, "buyback_log": [{"time": 2010}, {"time": 100}]},
               {"player_slot": 128, "hero_id": 2, "kills_log": [
                   {"time": 300, "key": "npc_dota_hero_antimage"}, {"time": 330, "key": "npc_dota_hero_antimage"},
                   {"time": 400, "key": "npc_dota_hero_antimage"},                      # серия: 3 смерти за 100 с
                   {"time": 1010, "key": "npc_dota_hero_antimage"}, {"time": 2005, "key": "npc_dota_hero_antimage"}]},
               {"player_slot": 129, "hero_id": 3, "kills_log": [{"time": 1020, "key": "npc_dota_hero_axe"}, {"time": 2020, "key": "npc_dota_hero_axe"},
                                                                {"time": 2025, "key": "npc_dota_hero_antimage"}]}]}
    r = build_mistakes(raw, HEROES, META)
    assert r["available"]
    am = next(p for p in r["players"] if p["slot"] == 0)
    kinds = [f["kind"] for f in am["findings"]]
    assert am["stats"]["deaths_known"] == 6 and am["stats"]["solo_deaths"] == 3
    assert "death_streak" in kinds and "buyback_wasted" in kinds and "first_death" in kinds
    assert am["stats"]["buybacks_wasted"] == 1 and am["stats"]["first_deaths"] == 2  # бай-бэк на 2010 → смерть на 2025; на 100 с — нет
    ax = next(p for p in r["players"] if p["slot"] == 128)
    assert ax["stats"]["first_deaths"] == 0
    assert any("вне командных боёв" in h for h in r["highlights"])


def test_unavailable_and_clean_match():
    assert build_mistakes({"players": []}, HEROES, {})["available"] is False
    clean = build_mistakes({"teamfights": [{"start": 10, "end": 20}], "players": [{"player_slot": 0, "hero_id": 1}]}, HEROES, META)
    assert clean["highlights"] == ["Явных ошибок по данным реплея не найдено."]
