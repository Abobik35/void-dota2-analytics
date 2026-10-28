IMG = "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/{}.png"


def _name(key: str | None, consts: dict, fallback: str) -> str:
    c = consts.get(key, {}) if key else {}
    return c.get("dname") or (key.replace("_", " ").title() if key else fallback)


def item_ref(item_id, ids: dict, consts: dict) -> dict | None:
    if not item_id:
        return None
    key = ids.get(str(item_id))
    cost = consts.get(key, {}).get("cost") if key else None
    return {"id": item_id, "key": key, "name": _name(key, consts, f"Предмет #{item_id}"),
            "img": IMG.format(key) if key else None, "cost": cost if isinstance(cost, int) else None}


def _purchase(e: dict, consts: dict) -> dict | None:
    key = e.get("key")
    if not isinstance(key, str) or key.startswith("recipe_"):
        return None
    cost = consts.get(key, {}).get("cost")
    return {"time": e.get("time"), "key": key, "name": _name(key, consts, key), "img": IMG.format(key),
            "cost": cost if isinstance(cost, int) else None}


def build_items(raw: dict, meta: dict[int, dict], ids: dict, consts: dict) -> dict:
    """meta: player_slot -> {hero_name, hero_img, name, account_id, is_radiant}."""
    players, has_log = [], False
    for p in raw.get("players", []):
        slot = p.get("player_slot", 0)
        m = meta.get(slot, {})
        log = p.get("purchase_log")
        purchases = None
        if isinstance(log, list):
            has_log = True
            purchases = [x for x in (_purchase(e, consts) for e in log if isinstance(e, dict)) if x]
        players.append({
            "slot": slot, "is_radiant": slot < 128, "hero_name": m.get("hero_name", "—"), "hero_img": m.get("hero_img"),
            "name": m.get("name"), "account_id": m.get("account_id"),
            "main": [item_ref(p.get(f"item_{i}"), ids, consts) for i in range(6)],
            "backpack": [item_ref(p.get(f"backpack_{i}"), ids, consts) for i in range(3)],
            "neutral": item_ref(p.get("item_neutral"), ids, consts), "purchases": purchases,
        })
    return {"data_status": "full" if has_log else "basic", "players": players}
