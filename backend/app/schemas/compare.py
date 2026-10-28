from pydantic import BaseModel

from app.schemas.player import PlayerAnalytics, PlayerProfile


class CompareSide(BaseModel):
    profile: PlayerProfile
    analytics: PlayerAnalytics


class CommonHeroSide(BaseModel):
    games: int
    wins: int
    win_rate: float


class CommonHero(BaseModel):
    hero_id: int
    hero_name: str
    hero_img: str | None
    a: CommonHeroSide
    b: CommonHeroSide


class CompareOut(BaseModel):
    a: CompareSide
    b: CompareSide
    common_heroes: list[CommonHero]
    warnings: list[str]
