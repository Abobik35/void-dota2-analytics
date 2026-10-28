from app.schemas.match import MatchOut, PlayerOut

IMG = "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/{}.png"


def is_parsed(raw: dict) -> bool:
    """Матч обработан, если есть хотя бы один признак данных из реплея (поле version не единственный)."""
    return (raw.get("version") is not None or bool(raw.get("radiant_gold_adv")) or bool(raw.get("teamfights"))
            or any(p.get("gold_t") for p in raw.get("players", [])))


def index_heroes(raw: list[dict]) -> dict[int, dict]:
    return {h["id"]: h for h in raw if "id" in h}


def _hero(heroes: dict[int, dict], hero_id: int) -> tuple[str, str | None]:
    h = heroes.get(hero_id)
    if not h:
        return f"Герой #{hero_id}", None
    return h.get("localized_name", f"Герой #{hero_id}"), IMG.format(h.get("name", "").removeprefix("npc_dota_hero_"))


def normalize_match(raw: dict, heroes: dict[int, dict]) -> MatchOut:
    team_kills = {True: 0, False: 0}
    for p in raw.get("players", []):
        team_kills[p.get("player_slot", 0) < 128] += p.get("kills") or 0
    players = []
    for p in raw.get("players", []):
        slot = p.get("player_slot", 0)
        k, d, a = (p.get(x) or 0 for x in ("kills", "deaths", "assists"))
        hero_id = p.get("hero_id") or 0
        hero_name, hero_img = _hero(heroes, hero_id)
        players.append(PlayerOut(
            slot=slot, is_radiant=slot < 128, account_id=p.get("account_id"),
            name=p.get("personaname") or p.get("name"), hero_id=hero_id,
            hero_name=hero_name, hero_img=hero_img, level=p.get("level"),
            kills=k, deaths=d, assists=a, kda=round((k + a) / max(d, 1), 2),
            kill_participation=round((k + a) / team_kills[slot < 128] * 100, 1) if team_kills[slot < 128] else None,
            gpm=p.get("gold_per_min"), xpm=p.get("xp_per_min"),
            last_hits=p.get("last_hits"), denies=p.get("denies"),
            hero_damage=p.get("hero_damage"), tower_damage=p.get("tower_damage"),
            hero_healing=p.get("hero_healing"), net_worth=p.get("net_worth"),
        ))
    return MatchOut(
        match_id=raw["match_id"], start_time=raw.get("start_time"), duration=raw.get("duration"),
        radiant_win=raw.get("radiant_win"), radiant_score=raw.get("radiant_score"),
        dire_score=raw.get("dire_score"), game_mode=raw.get("game_mode"),
        data_status="full" if is_parsed(raw) else "basic",
        players=players,
    )


hero_info = _hero  # публичное имя: (название, картинка) героя по id
