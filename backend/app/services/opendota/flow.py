import re
from collections import defaultdict

HERO_IMG = "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/{}.png"
_LANE = {"top": "верх", "mid": "центр", "bot": "низ"}
WARD_LIFE = {"obs": 360, "sen": 480}  # оценка, если реплей не сообщил, когда вард исчез
SIDE_RU = {"radiant": "Radiant", "dire": "Dire"}
OPP = {"radiant": "dire", "dire": "radiant"}


def side_of(slot: int) -> str:
    return "radiant" if slot < 128 else "dire"


def clock(t: float) -> str:
    t = int(t)
    sign, t = ("−" if t < 0 else ""), abs(t)
    return f"{sign}{t // 60}:{t % 60:02d}"


def _num(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def _xy(e: dict) -> tuple[float, float] | None:
    x, y = _num(e.get("x")), _num(e.get("y"))
    if x is not None and y is not None:
        return x, y
    key = e.get("key")
    if isinstance(key, (list, tuple)) and len(key) >= 2:
        x, y = _num(key[0]), _num(key[1])
    elif isinstance(key, str):
        nums = re.findall(r"-?\d+(?:\.\d+)?", key)
        x, y = (_num(nums[0]), _num(nums[1])) if len(nums) >= 2 else (None, None)
    return (x, y) if x is not None and y is not None else None


def turning_points(adv: list[int], window: int = 2, top: int = 3, min_gap: int = 3, min_abs: int = 1500) -> list[dict]:
    """Самые резкие сдвиги преимущества по золоту за `window` минут. Производный показатель."""
    cand = sorted(((abs(adv[i] - adv[i - window]), i) for i in range(window, len(adv))), reverse=True)
    picked: list[tuple[int, int]] = []
    for mag, i in cand:
        if mag < min_abs or len(picked) == top:
            break
        if all(abs(i - j) >= min_gap for _, j in picked):
            picked.append((mag, i))
    out = []
    for _, i in sorted(picked, key=lambda t: t[1]):
        d = adv[i] - adv[i - window]
        out.append({"minute": i, "delta": d, "from_adv": adv[i - window], "to_adv": adv[i],
                    "team": "radiant" if d > 0 else "dire"})
    return out


def building_label(key: str) -> str:
    k = key.lower()
    m = re.search(r"tower(\d)(?:_(top|mid|bot))?", k)
    if m:
        lane = f" ({_LANE[m.group(2)]})" if m.group(2) else ""
        return f"Башня {m.group(1)}{lane}"
    if "melee_rax" in k or "range_rax" in k:
        lane = next((f" ({v})" for t, v in _LANE.items() if k.endswith(t)), "")
        return f"Казармы {'ближнего' if 'melee' in k else 'дальнего'} боя{lane}"
    if "fort" in k or "ancient" in k:
        return "Трон"
    return key


def building_info(key: str) -> dict | None:
    k = key.lower()
    owner = "radiant" if "goodguys" in k else "dire" if "badguys" in k else None
    if owner is None:
        return None
    base = {"owner": owner, "label": building_label(key)}
    m = re.search(r"tower(\d)(?:_(top|mid|bot))?", k)
    if m:
        return {**base, "kind": "tower", "tier": int(m.group(1)), "lane": m.group(2), "variant": None}
    if "rax" in k:
        return {**base, "kind": "rax", "tier": None, "lane": next((l for l in _LANE if k.endswith(l)), None),
                "variant": "melee" if "melee" in k else "range"}
    if "fort" in k or "ancient" in k:
        return {**base, "kind": "ancient", "tier": None, "lane": None, "variant": None}
    return None


def _fmt(n: int) -> str:
    return f"{abs(int(n)):,}".replace(",", " ")


def _summary(events: list[dict], fights: list[dict], buildings: list[dict], turning: list[dict], has_objectives: bool) -> list[str]:
    out: list[str] = []
    kills = [e for e in events if e["type"] == "kill"]
    if kills:
        out.append(f"Первая кровь на {clock(kills[0]['time'])}: {kills[0]['text']}.")
    if buildings:
        b = min(buildings, key=lambda x: x["time"])
        out.append(f"Первое разрушенное здание — {b['label']} ({SIDE_RU[b['owner']]}), на {clock(b['time'])}.")
    if has_objectives:
        ro = [e for e in events if e["type"] == "roshan"]
        if ro:
            by = {s: sum(1 for e in ro if e["team"] == s) for s in ("radiant", "dire")}
            out.append(f"Убийств Рошана: {len(ro)} (Radiant — {by['radiant']}, Dire — {by['dire']}).")
        else:
            out.append("Рошана в этом матче не убивали.")
    if fights:
        w = max(fights, key=lambda f: f["deaths"])
        out.append(f"Командных боёв: {len(fights)}. Самый кровавый — на {clock(w['start'] or 0)}, погибло {w['deaths']}.")
    n_bb = sum(1 for e in events if e["type"] == "buyback")
    if n_bb:
        out.append(f"Бай-бэков за матч: {n_bb}.")
    if turning:
        t = max(turning, key=lambda x: abs(x["delta"]))
        out.append(f"Главный поворот — {t['minute']}-я минута: золото сместилось в пользу {SIDE_RU[t['team']]} "
                   f"на {_fmt(t['delta'])} за две минуты.")
    return out


def build_flow(raw: dict, heroes: dict[int, dict]) -> dict:
    players = raw.get("players") or []
    adv = raw.get("radiant_gold_adv") or []
    tfs_raw = raw.get("teamfights") or []
    objectives = raw.get("objectives") or []
    if not (adv or tfs_raw or objectives or any(p.get("kills_log") for p in players)):
        return {"available": False, "reason": "OpenDota ещё не обработал реплей: событий и боёв нет."}

    by_name = {h.get("name"): h for h in heroes.values()}

    def ref(h: dict | None, team: str | None, fallback: str = "Герой") -> dict:
        h = h or {}
        short = (h.get("name") or "").removeprefix("npc_dota_hero_")
        return {"name": h.get("localized_name") or fallback, "img": HERO_IMG.format(short) if short else None, "team": team}

    events: list[dict] = []
    for p in players:
        side = side_of(p.get("player_slot", 0))
        me = ref(heroes.get(p.get("hero_id")), side)
        for k in p.get("kills_log") or []:
            key = k.get("key")
            if k.get("time") is not None and isinstance(key, str) and key.startswith("npc_dota_hero_"):
                tgt = ref(by_name.get(key), OPP[side], key.removeprefix("npc_dota_hero_"))
                events.append({"time": k["time"], "type": "kill", "team": side, "actor": me, "target": tgt,
                               "text": f"{me['name']} убил {tgt['name']}"})
        for b in p.get("buyback_log") or []:
            if b.get("time") is not None:
                events.append({"time": b["time"], "type": "buyback", "team": side, "actor": me,
                               "text": f"{me['name']} купил возрождение"})

    buildings: list[dict] = []
    for o in objectives:
        t, typ, key = o.get("time"), o.get("type"), o.get("key")
        if t is None:
            continue
        if typ == "CHAT_MESSAGE_ROSHAN_KILL":
            team = {2: "radiant", 3: "dire"}.get(o.get("team"))
            events.append({"time": t, "type": "roshan", "team": team,
                           "text": "Рошан убит" + (f" командой {SIDE_RU[team]}" if team else "")})
        elif typ == "building_kill" and isinstance(key, str):
            info = building_info(key)
            if info:
                buildings.append({"time": t, **info})
                events.append({"time": t, "type": "building", "team": OPP[info["owner"]], "label": info["label"],
                               "text": f"{SIDE_RU[info['owner']]} потерял: {info['label']}"})
    events.sort(key=lambda e: e["time"])
    buildings.sort(key=lambda b: b["time"])

    fights = []
    deaths_map: list[dict] = []
    for tf in tfs_raw:
        rd = dd = rg = dg = 0
        for i, t in enumerate(tf.get("players") or []):
            if i >= len(players):
                break
            side = side_of(players[i].get("player_slot", 0))
            d, g = t.get("deaths") or 0, t.get("gold_delta") or 0
            if side == "radiant":
                rd, rg = rd + d, rg + g
            else:
                dd, dg = dd + d, dg + g
            for xs, col in (t.get("deaths_pos") or {}).items():
                for ys, cnt in (col or {}).items():
                    x, y = _num(xs), _num(ys)
                    if x is not None and y is not None:
                        deaths_map.append({"time": tf.get("start") or 0, "team": side, "x": x, "y": y, "count": int(cnt or 1)})
        fights.append({"start": tf.get("start"), "end": tf.get("end"), "deaths": tf.get("deaths") or rd + dd,
                       "radiant_deaths": rd, "dire_deaths": dd, "radiant_gold_delta": rg, "dire_gold_delta": dg,
                       "outcome": "radiant" if rd < dd else "dire" if dd < rd else "draw"})

    wards: list[dict] = []
    heat: dict[tuple[str, float, float], int] = defaultdict(int)
    for p in players:
        side = side_of(p.get("player_slot", 0))
        for kind in ("obs", "sen"):
            left = {e.get("ehandle"): e.get("time") for e in (p.get(f"{kind}_left_log") or [])
                    if isinstance(e, dict) and e.get("ehandle") is not None and e.get("time") is not None}
            for e in p.get(f"{kind}_log") or []:
                if not isinstance(e, dict) or e.get("time") is None or (xy := _xy(e)) is None:
                    continue
                until = left.get(e.get("ehandle"))
                wards.append({"time": e["time"], "until": until if until is not None else e["time"] + WARD_LIFE[kind],
                              "estimated": until is None, "kind": kind, "team": side, "x": xy[0], "y": xy[1]})
        for xs, col in (p.get("lane_pos") or {}).items():
            for ys, cnt in (col or {}).items():
                x, y = _num(xs), _num(ys)
                if x is not None and y is not None:
                    heat[(side, x, y)] += int(cnt or 0)
    lane_heat = [{"team": s, "x": x, "y": y, "w": w} for (s, x, y), w in sorted(heat.items(), key=lambda kv: -kv[1])[:500] if w > 0]

    turning = turning_points(adv) if adv else []
    return {"available": True, "reason": None, "duration": raw.get("duration"),
            "summary": _summary(events, fights, buildings, turning, bool(objectives)),
            "events": events, "teamfights": fights, "turning_points": turning,
            "wards": wards[:400], "deaths": deaths_map, "lane_heat": lane_heat, "buildings": buildings}
