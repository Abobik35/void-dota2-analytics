from statistics import mean

from app.schemas.analytics import MatchAnalytics, TeamTotals
from app.schemas.match import MatchOut, PlayerOut


def _sum(players: list[PlayerOut], field: str) -> int:
    return sum(getattr(p, field) or 0 for p in players)


def _sum_or_none(players: list[PlayerOut], field: str) -> int | None:
    vals = [getattr(p, field) for p in players]
    return None if not vals or any(v is None for v in vals) else sum(vals)


def _avg(players: list[PlayerOut], field: str) -> int | None:
    vals = [getattr(p, field) for p in players if getattr(p, field) is not None]
    return round(mean(vals)) if vals else None


def _team(side: str, players: list[PlayerOut]) -> TeamTotals:
    return TeamTotals(
        side=side, kills=_sum(players, "kills"), deaths=_sum(players, "deaths"),
        assists=_sum(players, "assists"), last_hits=_sum(players, "last_hits"),
        hero_damage=_sum(players, "hero_damage"), tower_damage=_sum(players, "tower_damage"),
        hero_healing=_sum(players, "hero_healing"), net_worth=_sum_or_none(players, "net_worth"),
        avg_gpm=_avg(players, "gpm"), avg_xpm=_avg(players, "xpm"),
    )


def team_analytics(m: MatchOut) -> MatchAnalytics:
    return MatchAnalytics(radiant=_team("radiant", [p for p in m.players if p.is_radiant]),
                          dire=_team("dire", [p for p in m.players if not p.is_radiant]))
