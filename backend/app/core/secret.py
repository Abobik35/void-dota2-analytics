import secrets
from pathlib import Path


def load_secret(configured: str | None, path: Path = Path(".secret_key")) -> bytes:
    """Секрет для подписи сессий: из настроек, иначе из файла .secret_key (создаётся при первом запуске)."""
    if configured and configured != "change-me":
        return configured.encode()
    if path.exists() and path.read_text().strip():
        return path.read_text().strip().encode()
    value = secrets.token_hex(32)
    path.write_text(value)
    return value.encode()
