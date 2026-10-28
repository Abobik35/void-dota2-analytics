import hmac
import secrets
import time
from datetime import datetime, timedelta
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, RedirectResponse

from app.core.config import settings
from app.core.secret import load_secret
from app.core.security import sign, verify
from app.db.session import SessionLocal, User
from app.services.opendota.client import SourceError, fetch_json
from app.services.steam_openid import STEAM_OPENID, login_url, to_account_id, validate_params

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])
COOKIE, STATE_COOKIE = "void_session", "void_oid_state"
_secret: bytes | None = None


def _key() -> bytes:
    global _secret
    if _secret is None:
        _secret = load_secret(settings.secret_key)
    return _secret


def _base() -> str:
    return settings.public_url.rstrip("/")


def _secure() -> bool:
    return _base().startswith("https://")


def _safe_next(n: str | None) -> str:
    return n if n and n.startswith("/") and not n.startswith("//") and "\\" not in n else "/"


def _return_to(state: str, nxt: str) -> str:
    return f"{_base()}/api/v1/auth/steam/callback?{urlencode({'state': state, 'next': nxt})}"


@router.get("/steam/login")
async def steam_login(next: str | None = None):
    state = secrets.token_urlsafe(16)
    resp = RedirectResponse(login_url(_base() + "/", _return_to(state, _safe_next(next))), status_code=303)
    resp.set_cookie(STATE_COOKIE, state, max_age=600, httponly=True, samesite="lax", secure=_secure())
    return resp


async def _steam_confirms(params: dict) -> bool:
    data = {k: v for k, v in params.items() if k.startswith("openid.")}
    data["openid.mode"] = "check_authentication"
    try:
        async with httpx.AsyncClient(timeout=settings.request_timeout_s) as c:
            r = await c.post(STEAM_OPENID, data=data)
    except httpx.HTTPError:
        return False
    return r.status_code == 200 and "is_valid:true" in r.text


@router.get("/steam/callback")
async def steam_callback(request: Request):
    params = dict(request.query_params)
    state, nxt = params.get("state", ""), _safe_next(params.get("next"))
    fail = RedirectResponse("/?login=error", status_code=303)
    if not state or not hmac.compare_digest(state, request.cookies.get(STATE_COOKIE, "")):
        return fail
    steam_id = validate_params(params, _return_to(state, nxt))
    if not steam_id or not await _steam_confirms(params):
        return fail

    now = datetime.utcnow()
    with SessionLocal() as db:
        user = db.get(User, steam_id)
        if user:
            user.last_login_at = now
        else:
            db.add(User(steam_id=steam_id, account_id=to_account_id(steam_id), created_at=now, last_login_at=now))
        db.commit()
    token = sign({"sid": steam_id, "exp": int(time.time()) + settings.session_days * 86400}, _key())
    resp = RedirectResponse(nxt, status_code=303)
    resp.set_cookie(COOKIE, token, max_age=settings.session_days * 86400, httponly=True, samesite="lax", secure=_secure())
    resp.delete_cookie(STATE_COOKIE)
    return resp


@router.get("/me")
async def me(request: Request):
    data = verify(request.cookies.get(COOKIE), _key())
    if not data or not isinstance(data.get("sid"), str):
        return {"logged_in": False}
    account_id = to_account_id(data["sid"])
    name = avatar = None
    try:  # имя и аватар берём из OpenDota, отдельный ключ Steam не нужен
        info = await fetch_json(f"/players/{account_id}", lambda d: timedelta(minutes=10) if (d or {}).get("profile") else timedelta(seconds=30),
                                "Игрок не найден в OpenDota.")
        profile = (info or {}).get("profile") or {}
        name, avatar = profile.get("personaname"), profile.get("avatarfull") or profile.get("avatarmedium")
    except SourceError:
        pass
    return {"logged_in": True, "steam_id": data["sid"], "account_id": account_id, "name": name, "avatar": avatar}


@router.post("/logout")
async def logout():
    resp = JSONResponse({"ok": True})
    resp.delete_cookie(COOKIE)
    return resp
