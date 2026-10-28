from app.main import rating

def test_rating_returns_explained_results():
    players=[
      {"account_id":1,"player_slot":0,"kills":10,"deaths":2,"assists":8,"gold_per_min":600,"xp_per_min":700,"hero_damage":30000,"tower_damage":5000,"hero_healing":0,"last_hits":300},
      {"account_id":2,"player_slot":128,"kills":2,"deaths":10,"assists":4,"gold_per_min":250,"xp_per_min":300,"hero_damage":7000,"tower_damage":100,"hero_healing":1000,"last_hits":50}]
    result=rating(players)
    assert result["available"]
    assert result["version"]=="1.0.0"
    assert result["players"][0]["rating"] >= result["players"][1]["rating"]

def test_empty_players():
    assert rating([])["available"] is False
