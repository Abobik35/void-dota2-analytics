from typing import Literal
from pydantic import BaseModel


class ItemRef(BaseModel):
    id: int
    key: str | None
    name: str
    img: str | None
    cost: int | None


class Purchase(BaseModel):
    time: int | None  # секунды от горна; до начала матча — отрицательные
    key: str
    name: str
    img: str | None
    cost: int | None


class PlayerItems(BaseModel):
    slot: int
    is_radiant: bool
    hero_name: str
    hero_img: str | None
    name: str | None
    account_id: int | None
    main: list[ItemRef | None]      # 6 основных слотов на конец матча
    backpack: list[ItemRef | None]  # 3 слота рюкзака
    neutral: ItemRef | None
    purchases: list[Purchase] | None  # None — матч не обработан, истории покупок нет


class ItemsOut(BaseModel):
    data_status: Literal["full", "basic"]
    players: list[PlayerItems]
