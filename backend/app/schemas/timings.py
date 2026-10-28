from pydantic import BaseModel


class TimedItem(BaseModel):
    key: str
    name: str
    img: str | None
    cost: int | None
    time: int                 # секунды от горна
    median: int | None        # типичное время покупки для этого героя
    p25: int | None
    p75: int | None
    delta: int | None         # time - median: меньше нуля — купил раньше обычного
    games: int | None
    here_wr: float | None     # win rate у героев, купивших примерно в это же время
    here_games: int | None


class PlayerTimings(BaseModel):
    slot: int
    is_radiant: bool
    hero_name: str
    hero_img: str | None
    name: str | None
    account_id: int | None
    items: list[TimedItem]
    avg_delta: int | None


class TimingsOut(BaseModel):
    available: bool
    reason: str | None = None
    note: str
    highlights: list[str] = []
    players: list[PlayerTimings] = []
