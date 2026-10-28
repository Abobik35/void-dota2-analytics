from pydantic import BaseModel


class PlayerProfile(BaseModel):
    account_id: int
    name: str | None
    avatar: str | None
    rank_tier: int | None
    mmr_estimate: int | None
    lifetime_wins: int | None
    lifetime_losses: int | None
    lifetime_win_rate: float | None


class PlayerMatch(BaseModel):
    match_id: int
    start_time: int | None
    duration: int | None
    game_mode: int | None
    lobby_type: int | None
    hero_id: int
    hero_name: str
    hero_img: str | None
    won: bool | None
    kills: int
    deaths: int
    assists: int
    kda: float
    gpm: int | None  # есть только у последних 20 матчей (источник recentMatches)
    xpm: int | None
    last_hits: int | None


class PlayerMatches(BaseModel):
    items: list[PlayerMatch]
    next_offset: int | None


class HeroStat(BaseModel):
    hero_id: int
    hero_name: str
    hero_img: str | None
    games: int
    wins: int
    win_rate: float


class FormItem(BaseModel):
    match_id: int
    won: bool | None


class PlayerAnalytics(BaseModel):
    sample_size: int
    wins: int
    losses: int
    win_rate: float | None
    avg_kills: float | None
    avg_deaths: float | None
    avg_assists: float | None
    kda: float | None
    avg_gpm: int | None
    avg_xpm: int | None
    gpm_sample: int
    top_heroes: list[HeroStat]
    form: list[FormItem]
