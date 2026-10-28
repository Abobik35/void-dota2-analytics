from typing import Literal
from pydantic import BaseModel

Side = Literal["radiant", "dire"]


class EventHero(BaseModel):
    name: str
    img: str | None
    team: Side | None


class FlowEvent(BaseModel):
    time: int
    type: Literal["kill", "buyback", "roshan", "building"]
    team: Side | None  # чья команда совершила действие
    text: str          # короткая фраза целиком (для подсказок и скринридеров)
    actor: EventHero | None = None
    target: EventHero | None = None
    label: str | None = None


class Teamfight(BaseModel):
    start: int | None
    end: int | None
    deaths: int
    radiant_deaths: int
    dire_deaths: int
    radiant_gold_delta: int
    dire_gold_delta: int
    outcome: Literal["radiant", "dire", "draw"]  # производный: по числу потерь


class TurningPoint(BaseModel):
    minute: int
    delta: int       # изменение преимущества Radiant по золоту за окно
    from_adv: int
    to_adv: int
    team: Side       # в чью пользу сдвиг


class Ward(BaseModel):
    time: int
    until: int
    estimated: bool  # True — момент исчезновения не пришёл из реплея, длительность оценена
    kind: Literal["obs", "sen"]
    team: Side
    x: float
    y: float


class MapDeath(BaseModel):
    time: int  # начало командного боя, в котором погиб игрок
    team: Side  # команда погибшего
    x: float
    y: float
    count: int


class HeatPoint(BaseModel):
    team: Side
    x: float
    y: float
    w: int


class BuildingEvent(BaseModel):
    time: int
    owner: Side  # чьё здание уничтожено
    kind: Literal["tower", "rax", "ancient"]
    tier: int | None
    lane: Literal["top", "mid", "bot"] | None
    variant: Literal["melee", "range"] | None
    label: str


class FlowOut(BaseModel):
    available: bool
    reason: str | None = None
    duration: int | None = None
    summary: list[str] = []
    events: list[FlowEvent] = []
    teamfights: list[Teamfight] = []
    turning_points: list[TurningPoint] = []
    wards: list[Ward] = []
    deaths: list[MapDeath] = []
    lane_heat: list[HeatPoint] = []
    buildings: list[BuildingEvent] = []
