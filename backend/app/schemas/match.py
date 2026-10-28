from typing import Literal
from pydantic import BaseModel


class PlayerOut(BaseModel):
    slot: int
    is_radiant: bool
    account_id: int | None
    name: str | None
    hero_id: int
    hero_name: str
    hero_img: str | None
    level: int | None
    kills: int
    deaths: int
    assists: int
    kda: float
    kill_participation: float | None  # % убийств команды, в которых участвовал (K+A)
    gpm: int | None
    xpm: int | None
    last_hits: int | None
    denies: int | None
    hero_damage: int | None
    tower_damage: int | None
    hero_healing: int | None
    net_worth: int | None


class MatchOut(BaseModel):
    match_id: int
    start_time: int | None
    duration: int | None
    radiant_win: bool | None
    radiant_score: int | None
    dire_score: int | None
    game_mode: int | None
    # full — матч обработан OpenDota, basic — только базовые данные
    data_status: Literal["full", "basic"]
    players: list[PlayerOut]
