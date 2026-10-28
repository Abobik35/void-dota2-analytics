import time
from pathlib import Path
import tempfile

from app.core.secret import load_secret
from app.core.security import sign, verify
from app.services.steam_openid import STEAM_OPENID, login_url, to_account_id, validate_params

RT = "http://localhost:5173/api/v1/auth/steam/callback?state=abc&next=%2F"
GOOD = {"openid.mode": "id_res", "openid.op_endpoint": STEAM_OPENID, "openid.return_to": RT,
        "openid.claimed_id": "https://steamcommunity.com/openid/id/76561199443805490",
        "openid.identity": "https://steamcommunity.com/openid/id/76561199443805490",
        "openid.signed": "signed,op_endpoint,claimed_id,identity,return_to,response_nonce,assoc_handle"}


def test_session_sign_verify():
    s = b"secret"
    tok = sign({"sid": "1", "exp": int(time.time()) + 60}, s)
    assert verify(tok, s)["sid"] == "1"
    assert verify(tok, b"other") is None
    assert verify(tok[:-2] + "xx", s) is None
    assert verify(sign({"sid": "1", "exp": int(time.time()) - 1}, s), s) is None
    assert verify(None, s) is None and verify("мусор", s) is None


def test_validate_params():
    assert validate_params(GOOD, RT) == "76561199443805490"
    assert validate_params({**GOOD, "openid.return_to": "http://evil/"}, RT) is None
    assert validate_params({**GOOD, "openid.op_endpoint": "https://evil.example/openid"}, RT) is None
    assert validate_params({**GOOD, "openid.claimed_id": "https://evil.example/id/1"}, RT) is None
    assert validate_params({**GOOD, "openid.identity": "https://steamcommunity.com/openid/id/76561199443805491"}, RT) is None
    assert validate_params({**GOOD, "openid.signed": "signed"}, RT) is None
    assert validate_params({**GOOD, "openid.mode": "cancel"}, RT) is None
    assert to_account_id("76561199443805490") == 1483539762


def test_login_url_and_secret():
    u = login_url("http://localhost:5173/", RT)
    assert u.startswith(STEAM_OPENID + "?") and "checkid_setup" in u and "identifier_select" in u
    with tempfile.TemporaryDirectory() as d:
        p = Path(d) / ".secret_key"
        a = load_secret(None, p)
        assert len(a) == 64 and load_secret("", p) == a and load_secret("mine", p) == b"mine"
