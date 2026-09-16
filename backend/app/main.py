"""Aplicação FastAPI do serviço de compilação.

Ao servidor cabe exclusivamente a compilação (constitution §6): ele não guarda
estado de projeto do usuário nem executa lógica de edição.
"""

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api import compile as compile_api
from app.api import health
from app.config import get_settings

app = FastAPI(
    title="LadderFlow — serviço de compilação",
    description="Compila Structured Text (IEC 61131-3) para firmware ESP32.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origin_list,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(compile_api.ErroCompilacaoHTTP)
async def _erro_compilacao_handler(
    _request: Request, exc: compile_api.ErroCompilacaoHTTP
) -> JSONResponse:
    """Serializa `ErroCompilacaoHTTP` no envelope Q-3, não em `{"detail": ...}`."""
    return JSONResponse(status_code=exc.status_code, content=exc.envelope.model_dump())


app.include_router(health.router)
app.include_router(compile_api.router)
