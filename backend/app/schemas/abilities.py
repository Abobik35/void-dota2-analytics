from typing import Literal
from pydantic import BaseModel


class AbilityRef(BaseModel):
    id: int
    key: str | None
    name: str
    img: str | None
    level: int | None  # уровень героя, на котором взята способность или талант


class PlayerAbilities(BaseModel):
    slot: int
    is_radiant: bool
    hero_name: str
    hero_img: str | None
    name: str | None
    account_id: int | None
    abilities: list[AbilityRef]  # в порядке прокачки; level = порядковый номер апгрейда
    talents: list[AbilityRef]


class AbilitiesOut(BaseModel):
    data_status: Literal["full", "basic"]
    players: list[PlayerAbilities]
