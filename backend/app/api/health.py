"""Verificação de saúde do serviço de compilação."""

from fastapi import APIRouter
from pydantic import BaseModel

from app.services import matiec

router = APIRouter(tags=["infra"])


class Iec2cInfo(BaseModel):
    available: bool
    path: str
    version: str | None = None


class HealthResponse(BaseModel):
    status: str
    iec2c: Iec2cInfo


@router.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    """Reporta se o serviço está de pé e se o compilador MATIEC está acessível."""
    state = matiec.status()
    return HealthResponse(
        status="ok",
        iec2c=Iec2cInfo(available=state.available, path=state.path, version=state.version),
    )
