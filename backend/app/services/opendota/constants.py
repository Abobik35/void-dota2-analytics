from datetime import timedelta

from app.services.opendota.client import fetch_json


async def load_item_constants() -> tuple[dict, dict]:
    """(id -> ключ предмета, ключ -> описание). Справочники меняются редко — кешируем на неделю."""
    ids = await fetch_json("/constants/item_ids", lambda _: timedelta(days=7))
    items = await fetch_json("/constants/items", lambda _: timedelta(days=7))
    return (ids if isinstance(ids, dict) else {}), (items if isinstance(items, dict) else {})
