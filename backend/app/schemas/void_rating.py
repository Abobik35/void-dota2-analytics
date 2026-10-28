from typing import Literal
from pydantic import BaseModel

Role = Literal["core", "support", "unknown"]


class RatedPlayer(BaseModel):
    slot: int
    is_radiant: bool
    account_id: int | None
    name: str | None
    hero_name: str
    hero_img: str | None
    role: Role
    rating: float
    categories: dict[str, float | None]
    completeness: float  # доля показателей, которые удалось использовать (0..1)
    positives: list[str]
    negatives: list[str]


class Mvp(BaseModel):
    slot: int
    account_id: int | None
    name: str | None
    hero_name: str
    hero_img: str | None
    rating: float | None
    basis: Literal["void_rating", "kda"]
    reasons: list[str]


class VoidRatingOut(BaseModel):
    version: str
    available: bool
    reason: str | None = None
    mvp: Mvp | None
    players: list[RatedPlayer]
    limitations: list[str]
