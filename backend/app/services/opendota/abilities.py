"""Прокачка способностей и талантов из данных обработанного матча.

OpenDota отдаёт порядок апгрейдов одним массивом ability_upgrades_arr:
обидательные id слева направо, таланты (special_bonus_*) среди них.
Статы прокачки в массив не попадают, поэтому честный номер апгрейда —
порядковый номер в списке, а не уровень героя.
"""
import re

CDN = "https://cdn.cloudflare.steamstatic.com"
_PLACEHOLDER = re.compile(r"\{s:[^}]*\}")


def _clean(name: str | None) -> str:
    """Заменяем шаблонные вставки вида {s:bonus_gold} на «N» в названиях талантов."""
    return _PLACEHOLDER.sub("N", name).strip() if isinstance(name, str) else name


def ability_ref(idx: int, aid, ids: dict, consts: dict) -> dict | None:
    """Один апгрейд: idx — порядковый номер прокачки, aid — id способности."""
    if aid is None:
        return None
    key = ids.get(str(aid))
    c = consts.get(key, {}) if key else {}
    img = c.get("img")
    name = _clean(c.get("dname"))
    return {
        "id": aid, "key": key,
        "name": name or (key.replace("_", " ").title() if key else f"Ability #{aid}"),
        "img": f"{CDN}{img}" if img else None,
        "level": idx,
    }


def build_abilities(raw: dict, meta: dict[int, dict], ids: dict, consts: dict) -> dict:
    """meta: player_slot -> {hero_name, hero_img, name, account_id, is_radiant}."""
    players, has_data = [], False
    for p in raw.get("players", []):
        slot = p.get("player_slot", 0)
        m = meta.get(slot, {})
        abilities, talents = [], []
        arr = p.get("ability_upgrades_arr")
        if isinstance(arr, list):
            for idx, aid in enumerate(arr, start=1):
                ref = ability_ref(idx, aid, ids, consts)
                if not ref:
                    continue
                if (ref.get("key") or "").startswith("special_bonus"):
                    talents.append(ref)
                else:
                    abilities.append(ref)
        if abilities:
            has_data = True
        players.append({
            "slot": slot, "is_radiant": slot < 128,
            "hero_name": m.get("hero_name", "—"), "hero_img": m.get("hero_img"),
            "name": m.get("name"), "account_id": m.get("account_id"),
            "abilities": abilities, "talents": talents,
        })
    return {"data_status": "full" if has_data else "basic", "players": players}
