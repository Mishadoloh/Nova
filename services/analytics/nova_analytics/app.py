from __future__ import annotations

import hmac
import os
from typing import Annotated

from fastapi import Depends, FastAPI, Header, HTTPException, status

from . import __version__
from .engine import summarize
from .models import AnalyticsRequest

app = FastAPI(
    title="NOVA Analytics",
    version=__version__,
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)


def require_service_token(
    authorization: Annotated[str | None, Header()] = None,
) -> None:
    expected = os.environ.get("NOVA_INTERNAL_TOKEN", "")
    provided = (authorization or "").removeprefix("Bearer ").strip()
    if len(expected) < 12 or not hmac.compare_digest(provided, expected):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "AUTH_REQUIRED", "message": "service authentication failed"},
        )


@app.get("/health")
def health() -> dict[str, object]:
    return {"ok": True, "service": "nova-analytics", "version": __version__}


@app.post("/v1/analytics/summary", dependencies=[Depends(require_service_token)])
def analytics_summary(payload: AnalyticsRequest) -> dict[str, object]:
    summary = summarize(payload)
    return {"ok": True, "data": summary.model_dump(by_alias=True)}

