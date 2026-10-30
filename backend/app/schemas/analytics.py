from typing import Literal
from pydantic import BaseModel


class Timeline(BaseModel):
    available: bool
    minutes: list[int] = []
    gold_adv: list[int] = []  # >0 — преимущество Radiant
    xp_adv: list[int] = []
    net_adv: list[int] = []   # разница нетворта Radiant - Dire по минутам
    reason: str | None = None


class TeamTotals(BaseModel):
    side: Literal["radiant", "dire"]
    kills: int
    deaths: int
    assists: int
    last_hits: int
    hero_damage: int
    tower_damage: int
    hero_healing: int
    net_worth: int | None
    avg_gpm: int | None
    avg_xpm: int | None


class MatchAnalytics(BaseModel):
    radiant: TeamTotals
    dire: TeamTotals
