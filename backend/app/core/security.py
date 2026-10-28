import base64
import hashlib
import hmac
import json
import time


def _b64(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).rstrip(b"=").decode()


def _unb64(s: str) -> bytes:
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


def sign(payload: dict, secret: bytes) -> str:
    body = _b64(json.dumps(payload, separators=(",", ":")).encode())
    return f"{body}.{_b64(hmac.new(secret, body.encode(), hashlib.sha256).digest())}"


def verify(token: str | None, secret: bytes) -> dict | None:
    """Проверяет подпись и срок жизни. Любая ошибка — просто «не вошёл»."""
    try:
        body, sig = token.split(".", 1)  # type: ignore[union-attr]
        if not hmac.compare_digest(sig, _b64(hmac.new(secret, body.encode(), hashlib.sha256).digest())):
            return None
        data = json.loads(_unb64(body))
        return data if isinstance(data, dict) and data.get("exp", 0) >= time.time() else None
    except (AttributeError, ValueError, TypeError):
        return None
