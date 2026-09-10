"""Verificação de saúde do serviço de compilação."""

from fastapi import APIRouter
from pydantic import BaseModel

from app.services import esp32, matiec

router = APIRouter(tags=["infra"])


class Iec2cInfo(BaseModel):
    available: bool
    path: str
    version: str | None = None


class EspIdfInfo(BaseModel):
    available: bool
    path: str
    version: str | None = None


class HealthResponse(BaseModel):
    status: str
    iec2c: Iec2cInfo
    esp_idf: EspIdfInfo


@router.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    """Reporta se o serviço está de pé e se as duas etapas de compilação estão acessíveis."""
    iec2c_state = matiec.status()
    idf_state = esp32.status()
    return HealthResponse(
        status="ok",
        iec2c=Iec2cInfo(
            available=iec2c_state.available,
            path=iec2c_state.path,
            version=iec2c_state.version,
        ),
        esp_idf=EspIdfInfo(
            available=idf_state.available,
            path=idf_state.path,
            version=idf_state.version,
        ),
    )
