from app.services.opendota.timings import assemble, pick_key_items, summarize_timings

ROWS = [{"time": 600, "games": "10", "wins": "6"}, {"time": 780, "games": 50, "wins": 30},
        {"time": 960, "games": 30, "wins": 12}, {"time": 1140, "games": 10, "wins": 3}, {"time": 5, "games": 0}, "мусор"]


def test_summarize_weighted_percentiles():
    b = summarize_timings(ROWS)
    assert b["games"] == 100 and b["median"] == 780 and b["p25"] == 780 and b["p75"] == 960
    assert summarize_timings([]) is None and summarize_timings([{"time": "x", "games": 3}]) is None
    m = summarize_timings([{"time": 10, "games": 5, "wins": 2}, {"time": 14, "games": 5, "wins": 2}])
    assert m["median"] == 600  # время пришло в минутах


def test_pick_key_items_first_buy_top_by_cost():
    p = [{"key": "blink", "time": 900, "cost": 2250, "name": "Blink"}, {"key": "blink", "time": 1500, "cost": 2250, "name": "Blink"},
         {"key": "tp", "time": 10, "cost": 50, "name": "TP"}, {"key": "bkb", "time": 1300, "cost": 4050, "name": "BKB"},
         {"key": "bf", "time": -20, "cost": 4100, "name": "BF"}]
    out = pick_key_items(p)
    assert [x["key"] for x in out] == ["blink", "bkb"] and out[0]["time"] == 900


def test_assemble_deltas_and_highlights():
    bench = {(1, "blink"): summarize_timings(ROWS), (2, "blink"): summarize_timings(ROWS)}
    mk = lambda slot, hero, t: {"slot": slot, "is_radiant": slot < 128, "hero_name": f"H{hero}", "hero_img": None, "name": None, "account_id": None,
                                "purchases": [{"key": "blink", "time": t, "cost": 2250, "name": "Blink Dagger", "img": None}]}
    players, hl = assemble([mk(0, 1, 600), mk(128, 2, 1000)], {0: 1, 128: 2}, bench)
    assert players[0]["items"][0]["delta"] == -180 and players[1]["items"][0]["delta"] == 220
    assert players[0]["avg_delta"] == -180 and players[0]["items"][0]["here_wr"] is None  # в корзине всего 10 игр
    assert players[1]["items"][0]["here_wr"] == 40.0 and players[1]["items"][0]["here_games"] == 30
    assert any("Самая быстрая" in h for h in hl) and any("Самая поздняя" in h for h in hl) and any("Radiant" in h for h in hl)
    none_players, none_hl = assemble([mk(0, 9, 600)], {0: 9}, {})
    assert none_players[0]["items"][0]["delta"] is None and none_players[0]["avg_delta"] is None and none_hl == []
