from typing import Literal
from pydantic import BaseModel

Role = Literal["core", "support", "unknown"]


class Contribution(BaseModel):
    label: str
    points: float  # вклад в итоговый рейтинг относительно среднего уровня (50); сумма всех вкладов = рейтинг − 50
    detail: str


class RatedPlayer(BaseModel):
    slot: int
    is_radiant: bool
    account_id: int | None
    name: str | None
    hero_name: str
    hero_img: str | None
    role: Role
    position: int | None = None  # 1–5, если хватило данных о линиях
    rating: float
    margin: float = 0.0          # примерная погрешность оценки (±)
    confidence: float = 1.0      # доверие к оценке, 0..1
    categories: dict[str, float | None]
    completeness: float          # доля показателей, которые удалось использовать (0..1)
    contributions: list[Contribution] = []
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
