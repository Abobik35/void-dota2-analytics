from app.services.analytics.compare import common_heroes, sample_warnings


def _r(h, won):
    return {"hero_id": h, "won": won}


def test_common_heroes_sorted_by_shared_games():
    a = [_r(1, True), _r(1, False), _r(1, True), _r(2, True), _r(3, False)]
    b = [_r(1, False), _r(1, False), _r(2, True), _r(2, True), _r(4, True)]
    c = common_heroes(a, b)
    assert [x["hero_id"] for x in c] == [1, 2]
    assert c[0]["a"] == {"games": 3, "wins": 2, "win_rate": 66.7} and c[0]["b"]["wins"] == 0
    assert common_heroes([_r(0, True)], [_r(0, True)]) == []


def test_sample_warnings():
    assert sample_warnings(100, 95) == []
    assert any("меньше 20" in w for w in sample_warnings(10, 100))
    assert any("разного размера" in w for w in sample_warnings(30, 100))
    assert any("нет матчей" in w for w in sample_warnings(0, 50))
