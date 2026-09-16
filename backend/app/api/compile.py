"""`POST /compile` — recebe Structured Text, devolve o firmware do ESP32.

Porta de entrada síncrona (Q-6 da spec 001) sobre `app/services/pipeline.py`:
uma requisição bloqueia até o binário ou até o envelope de erro estável
(Q-3). Este módulo não fala com `iec2c`/`idf.py` diretamente — isso é
responsabilidade exclusiva de `matiec.py` e `esp32.py`, por trás do pipeline.

`checar_tamanho_corpo` (dependência) e `mapear_falha` (função) são o ponto de
reúso desenhado para a S2: `POST /compile/pacote` usa as duas mesmas peças —
o limite de tamanho do corpo (Q-2) é idêntico nos dois endpoints, e o
mapeamento `FalhaCompilacao -> status HTTP` também, porque o contrato de erro
não muda com o formato de saída.
"""

from fastapi import APIRouter, Depends, Request
from fastapi.responses import Response
from pydantic import BaseModel

from app.config import get_settings
from app.services import pipeline

router = APIRouter(tags=["compile"])

# Nome do arquivo devolvido em Content-Disposition no sucesso de POST /compile.
_BINARY_FILENAME = "ladderflow_plc.bin"


class CompileRequest(BaseModel):
    """Corpo de `POST /compile`: `{"source": "<texto ST>"}`."""

    source: str


class DiagnosticoResposta(BaseModel):
    """Um item de `diagnostics` no envelope de erro (Q-3)."""

    file: str
    line: int | None
    column: int | None
    severity: str
    message: str


class RawResposta(BaseModel):
    """Saída bruta e íntegra da etapa que falhou (Q-3): nunca é recortada."""

    stdout: str
    stderr: str


class EnvelopeErro(BaseModel):
    """Envelope de erro estável da spec 001 (Q-3), com a revisão `stage: "request"`."""

    stage: str
    code: str
    message: str
    diagnostics: list[DiagnosticoResposta] = []
    raw: RawResposta


class ErroCompilacaoHTTP(Exception):
    """Exceção que carrega o envelope de erro e o status HTTP a devolver.

    Registrada como *exception handler* em `app/main.py` — é assim que
    `raise` dentro de uma dependência ou de um endpoint vira resposta JSON
    com o envelope no corpo (não `{"detail": ...}`, formato padrão do
    `HTTPException`, que quebraria o contrato Q-3).
    """

    def __init__(self, status_code: int, envelope: EnvelopeErro) -> None:
        super().__init__(envelope.message)
        self.status_code = status_code
        self.envelope = envelope


def _erro_payload_too_large(limite: int) -> ErroCompilacaoHTTP:
    return ErroCompilacaoHTTP(
        status_code=413,
        envelope=EnvelopeErro(
            stage="request",
            code="payload_too_large",
            message=f"corpo da requisição excede o limite de {limite} bytes",
            diagnostics=[],
            raw=RawResposta(stdout="", stderr=""),
        ),
    )


async def checar_tamanho_corpo(request: Request) -> None:
    """Impõe o limite do corpo (Q-2 = 262 144 bytes) antes de qualquer compilação.

    Dupla checagem, como o contrato da spec 001 exige: primeiro o cabeçalho
    `Content-Length` (rejeição sem sequer ler o corpo, quando o cliente o
    envia corretamente), depois o tamanho efetivo do corpo lido — o
    cabeçalho pode faltar ou mentir. `Request.body()` é cacheado pelo
    Starlette, então o parsing normal do Pydantic model que roda depois
    (`CompileRequest`) não lê o corpo de novo da rede.
    """
    limite = get_settings().compile_max_body_bytes

    content_length = request.headers.get("content-length")
    if content_length is not None:
        try:
            declarado = int(content_length)
        except ValueError:
            declarado = None
        if declarado is not None and declarado > limite:
            raise _erro_payload_too_large(limite)

    corpo = await request.body()
    if len(corpo) > limite:
        raise _erro_payload_too_large(limite)


def mapear_falha(falha: pipeline.FalhaCompilacao) -> ErroCompilacaoHTTP:
    """Traduz uma `FalhaCompilacao` do pipeline para o envelope HTTP (Q-3).

    Tabela de status, fixada no plano da spec 001:

    | stage / code                      | HTTP |
    |---|---|
    | `matiec` + `compile_error`        | 422  |
    | `esp32` + `compile_error`         | 500  |
    | qualquer stage + `toolchain_error`| 503  |
    | qualquer stage + `timeout`        | 504  |
    """
    if falha.code == "toolchain_error":
        status_code = 503
    elif falha.code == "timeout":
        status_code = 504
    elif falha.code == "compile_error":
        status_code = 422 if falha.stage == "matiec" else 500
    else:  # pragma: no cover - defensivo; todo code emitido pelo pipeline está acima
        status_code = 500

    return ErroCompilacaoHTTP(
        status_code=status_code,
        envelope=EnvelopeErro(
            stage=falha.stage,
            code=falha.code,
            message=falha.message,
            diagnostics=[
                DiagnosticoResposta(
                    file=d.file,
                    line=d.line,
                    column=d.column,
                    severity=d.severity,
                    message=d.message,
                )
                for d in falha.diagnostics
            ],
            raw=RawResposta(stdout=falha.raw_stdout, stderr=falha.raw_stderr),
        ),
    )


@router.post("/compile", dependencies=[Depends(checar_tamanho_corpo)])
def compile_source(req: CompileRequest) -> Response:
    """Compila `req.source` e devolve o `.bin` da aplicação, ou o envelope de erro.

    Síncrono de propósito (`def`, não `async def`): o FastAPI roda este
    endpoint em *threadpool*, o que mantém o *event loop* livre enquanto
    `pipeline.compilar` bloqueia por até `compile_timeout_esp32_s` chamando
    `iec2c`/`idf.py`.
    """
    resultado = pipeline.compilar(req.source)
    if isinstance(resultado, pipeline.FalhaCompilacao):
        raise mapear_falha(resultado)

    return Response(
        content=resultado.binary.read_bytes(),
        media_type="application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{_BINARY_FILENAME}"'},
    )
