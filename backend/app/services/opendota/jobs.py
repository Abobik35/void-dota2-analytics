from typing import Any


def extract_job_id(data: Any) -> int | None:
    """Ищет jobId в ответе OpenDota на запрос обработки. Форма ответа не гарантирована, поэтому осторожно."""
    if not isinstance(data, dict):
        return None
    for src in (data.get("job"), data):
        if isinstance(src, dict):
            v = src.get("jobId")
            if isinstance(v, int) and not isinstance(v, bool):
                return v
            if isinstance(v, str) and v.isdigit():
                return int(v)
    return None
