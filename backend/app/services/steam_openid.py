"""Вход через Steam (OpenID 2.0). Чистая логика без сети: ссылки и проверка параметров ответа."""
import re
from urllib.parse import urlencode

STEAM_OPENID = "https://steamcommunity.com/openid/login"
NS = "http://specs.openid.net/auth/2.0"
SELECT = f"{NS}/identifier_select"
ID_RE = re.compile(r"^https://steamcommunity\.com/openid/id/(\d{17})$")
STEAM64_BASE = 76561197960265728


def login_url(realm: str, return_to: str) -> str:
    q = {"openid.ns": NS, "openid.mode": "checkid_setup", "openid.return_to": return_to, "openid.realm": realm,
         "openid.identity": SELECT, "openid.claimed_id": SELECT}
    return f"{STEAM_OPENID}?{urlencode(q)}"


def validate_params(params: dict, expected_return_to: str) -> str | None:
    """Возвращает SteamID64 или None. Подпись проверяет сам Steam (check_authentication), здесь — всё остальное."""
    if params.get("openid.mode") != "id_res" or params.get("openid.op_endpoint") != STEAM_OPENID:
        return None
    if params.get("openid.return_to") != expected_return_to:
        return None
    claimed = params.get("openid.claimed_id", "")
    m = ID_RE.match(claimed)
    if not m or params.get("openid.identity") != claimed:
        return None
    if not {"claimed_id", "identity", "return_to", "op_endpoint"} <= set(params.get("openid.signed", "").split(",")):
        return None
    return m.group(1)


def to_account_id(steam_id: str) -> int:
    return int(steam_id) - STEAM64_BASE
