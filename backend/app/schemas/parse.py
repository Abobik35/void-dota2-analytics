from typing import Literal
from pydantic import BaseModel


class ParseRequestOut(BaseModel):
    status: Literal["queued", "already_parsed", "recently_requested"]
    job_id: int | None = None


class ParseStatus(BaseModel):
    parsed: bool
