from app.services.opendota.flow import build_flow, building_label, turning_points
from app.services.opendota.items import build_items, item_ref

HEROES = {1: {"id": 1, "name": "npc_dota_hero_antimage", "localized_name": "Anti-Mage"},
          2: {"id": 2, "name": "npc_dota_hero_axe", "localized_name": "Axe"}}


def test_turning_points_pick_biggest_swings_without_overlap():
    adv = [0, 100, 200, 300, -2500, -2600, -2700, 1800, 1900, 2000]
    pts = turning_points(adv)
    assert pts[0]["minute"] in (4, 5) and pts[0]["team"] == "dire"
    assert any(p["team"] == "radiant" for p in pts)
    assert all(abs(a["minute"] - b["minute"]) >= 3 for a in pts for b in pts if a is not b)
    assert turning_points([0, 10, 20, 30]) == []


def test_flow_unavailable_and_events():
    assert build_flow({"players": []}, HEROES)["available"] is False
    raw = {"radiant_gold_adv": [0, 0, 0], "players": [
        {"player_slot": 0, "hero_id": 1, "kills_log": [{"time": 100, "key": "npc_dota_hero_axe"}], "buyback_log": [{"time": 500}]},
        {"player_slot": 128, "hero_id": 2}],
        "objectives": [{"time": 300, "type": "building_kill", "key": "npc_dota_goodguys_tower1_top"},
                       {"time": 600, "type": "CHAT_MESSAGE_ROSHAN_KILL", "team": 3}],
        "teamfights": [{"start": 90, "end": 110, "deaths": 1, "players": [{"deaths": 0, "gold_delta": 300}, {"deaths": 1, "gold_delta": -200}]}]}
    f = build_flow(raw, HEROES)
    assert [e["type"] for e in f["events"]] == ["kill", "building", "buyback", "roshan"]
    assert f["events"][0]["text"] == "Anti-Mage убил Axe" and f["events"][1]["team"] == "dire"
    assert f["teamfights"][0]["outcome"] == "radiant" and f["teamfights"][0]["radiant_gold_delta"] == 300


def test_building_label():
    assert building_label("npc_dota_goodguys_tower1_top") == "Башня 1 (верх)"
    assert building_label("npc_dota_badguys_melee_rax_bot").startswith("Казармы ближнего боя")


def test_items():
    ids, consts = {"1": "blink"}, {"blink": {"dname": "Blink Dagger", "cost": 2250}}
    assert item_ref(0, ids, consts) is None
    r = item_ref(1, ids, consts)
    assert r["name"] == "Blink Dagger" and r["cost"] == 2250 and r["img"].endswith("/blink.png")
    assert item_ref(99, ids, consts)["name"] == "Предмет #99"
    raw = {"players": [{"player_slot": 0, "item_0": 1, "purchase_log": [{"time": 5, "key": "blink"}, {"time": 6, "key": "recipe_x"}]}]}
    out = build_items(raw, {0: {"hero_name": "Axe"}}, ids, consts)
    assert out["data_status"] == "full" and len(out["players"][0]["purchases"]) == 1
    assert build_items({"players": [{"player_slot": 128}]}, {}, ids, consts)["players"][0]["purchases"] is None


def test_map_layers_and_summary():
    from app.services.opendota.flow import build_flow, building_info
    raw = {"duration": 1800, "radiant_gold_adv": [0, 0, 0, 3000], "players": [
        {"player_slot": 0, "hero_id": 1, "kills_log": [{"time": 100, "key": "npc_dota_hero_axe"}],
         "obs_log": [{"time": 60, "x": 80, "y": 90, "ehandle": 7}, {"time": 70, "key": [100, 110]}],
         "obs_left_log": [{"time": 200, "ehandle": 7}], "sen_log": [{"time": 90, "key": "[120, 130]"}],
         "lane_pos": {"70": {"74": 3}}},
        {"player_slot": 128, "hero_id": 2}],
        "objectives": [{"time": 300, "type": "building_kill", "key": "npc_dota_goodguys_melee_rax_top"}],
        "teamfights": [{"start": 90, "end": 110, "deaths": 1, "players": [{"deaths": 0}, {"deaths": 1, "deaths_pos": {"100": {"101": 1}}}]}]}
    f = build_flow(raw, HEROES)
    w = f["wards"]
    assert w[0]["until"] == 200 and not w[0]["estimated"] and w[1]["estimated"] and w[1]["until"] == 70 + 360
    assert (w[2]["kind"], w[2]["x"], w[2]["y"]) == ("sen", 120.0, 130.0)
    assert f["deaths"] == [{"time": 90, "team": "dire", "x": 100.0, "y": 101.0, "count": 1}]
    assert f["lane_heat"][0]["team"] == "radiant" and f["lane_heat"][0]["w"] == 3
    assert f["buildings"][0]["kind"] == "rax" and f["buildings"][0]["variant"] == "melee" and f["buildings"][0]["lane"] == "top"
    assert f["events"][0]["actor"]["name"] == "Anti-Mage" and f["events"][0]["target"]["team"] == "dire"
    assert f["summary"][0].startswith("Первая кровь на 1:40") and any("Рошана" in s for s in f["summary"])
    assert building_info("npc_dota_badguys_fort")["kind"] == "ancient" and building_info("npc_dota_creep") is None
