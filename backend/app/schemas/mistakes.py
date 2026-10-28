from typing import Literal
from pydantic import BaseModel


class Finding(BaseModel):
    time: int | None
    kind: Literal["solo_death", "death_streak", "first_death", "buyback_wasted", "idle_farm"]
    severity: Literal["info", "warn"]
    text: str


class PlayerMistakes(BaseModel):
    slot: int
    is_radiant: bool
    hero_name: str
    hero_img: str | None
    name: str | None
    account_id: int | None
    stats: dict[str, int | float | None]
    findings: list[Finding]


class MistakesOut(BaseModel):
    available: bool
    reason: str | None = None
    highlights: list[str] = []
    players: list[PlayerMistakes] = []
    limitations: list[str] = []
