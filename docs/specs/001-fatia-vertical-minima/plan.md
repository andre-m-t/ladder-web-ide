# Plano 001 — Fatia vertical mínima

> **Status:** aprovado
> **Spec de origem:** [`spec.md`](./spec.md) — Q-1 a Q-6 decididas (Q-2 em 2026-09-16, as demais em 2026-09-10)
> **Autor:** André · **Data:** 2026-09-16 · **Aprovação:** registrada em
> `/home/andre/.claude/plans/precisamos-planejar-e-implementar-sorted-blossom.md`

Este documento descreve **o como**. Cada decisão aqui rastreia para um
requisito da `spec.md`.

---

## 1. Resumo da abordagem

A metade servidor do pipeline (`matiec.py` → `esp32.py`) já existe e já
compila `blink.st` até um `.bin` que dá boot em QEMU (F2/F3). O que falta para
fechar a fatia vertical mínima é expor esse pipeline por HTTP, provar que o
binário resultante pode ser gravado com os offsets certos, e dar ao usuário
uma tela — por crua que seja — para acionar as duas coisas sem terminal.

A entrega é dividida em três sprints. A **S1** implementa `POST /compile`
sozinha, porque fixa o contrato (envelope de erro, limite de corpo, timeouts)
do qual as outras duas dependem. Feita e commitada a S1, **S2** (gravação —
camada servidor, `POST /compile/pacote` + validação em QEMU) e **S3**
(gravação no navegador + tela mínima) rodam em paralelo: não compartilham
arquivo nenhum, só o contrato já fixado pela S1.

O formato de saída do firmware é dividido em dois: `POST /compile` devolve
apenas o `.bin` da aplicação (uso simples, ex.: inspeção manual), e
`POST /compile/pacote` (S2) devolve as três imagens do flash (bootloader,
tabela de partições, aplicação) com seus offsets, porque é isso que a gravação
via `esptool-js` no navegador (RF-5) precisa para escrever a flash inteira.

## 2. Reúso do que já existe

- `backend/app/services/matiec.py` — `compile_st_to_c`, `status`,
  `MatiecError`/`MatiecNotAvailable`/`MatiecTimeout`. A S1 acrescenta
  `parse_diagnostics` e o dataclass `Diagnostic`, sem alterar o que já existe.
- `backend/app/services/esp32.py` — `build_firmware`, `default_work_dir`,
  `status`, `Esp32Error`/`Esp32NotAvailable`/`Esp32Timeout`. A S2 acrescenta
  `flash_manifest`, lendo o `flasher_args.json` que o `idf.py build` já
  produz — nenhuma mudança na função de build.
- `backend/app/config.py` — `Settings`/`get_settings()`; a S1 acrescenta os
  três campos do contrato (`compile_max_body_bytes`,
  `compile_timeout_matiec_s`, `compile_timeout_esp32_s`).
- `backend/app/api/health.py` — padrão de router FastAPI com Pydantic
  `response_model`, reaproveitado por `api/compile.py`.
- `backend/tests/conftest.py` — fixtures `client`, `minimal_st`, `blink_st`;
  a S1 só lê os arquivos de `tests/fixtures/`, não precisa de fixture nova
  além das saídas capturadas do `iec2c`.
- `scripts/build-deposito.sh` — `REQUIRED_FILES` já existe como manifesto;
  a S1 só acrescenta duas linhas.
- `.claude/state.md` — painel já instituído; a S1 segue o formato existente.

Nada é descartado ou reescrito — tudo listado acima permanece com a mesma
assinatura pública.

## 3. Componentes afetados

| Componente | Caminho | Novo/alterado | Responsabilidade |
|---|---|---|---|
| Parser de diagnóstico | `backend/app/services/matiec.py` | alterado | `parse_diagnostics(stdout, stderr) -> list[Diagnostic]`, best-effort |
| Fixtures do iec2c | `backend/tests/fixtures/iec2c_saidas/` | novo | Saída real capturada, base do parser e dos testes |
| Pipeline de compilação | `backend/app/services/pipeline.py` | novo | Encadeia matiec → esp32, timeouts, lock, mapeamento de exceções |
| Configuração do contrato | `backend/app/config.py` | alterado | Limite de corpo (Q-2) e timeouts por etapa |
| Endpoint de compilação | `backend/app/api/compile.py` | novo | `POST /compile`, validação de tamanho, envelope de erro |
| Registro do router | `backend/app/main.py` | alterado | Inclui `compile.router` e o *exception handler* do envelope |
| Testes de contrato | `backend/tests/test_compile_api.py` | novo | Contrato rápido (monkeypatch), iec2c real, e2e lento, parser |
| Manifesto do depósito | `scripts/build-deposito.sh` | alterado | `api/compile.py` e `services/pipeline.py` em `REQUIRED_FILES` |
| Manifesto de flash | `backend/app/services/esp32.py` | alterado (S2) | `flash_manifest(build_dir)` lendo `flasher_args.json` |
| Endpoint de pacote | `backend/app/api/compile.py` | alterado (S2) | `POST /compile/pacote`, reaproveitando validação e mapeamento da S1 |
| Wrapper de gravação | `frontend/src/lib/gravador.ts` | novo (S3) | `esptool-js` sobre Web Serial |
| Tela mínima | `frontend/src/App.tsx` + `components/` | novo (S3) | RF-1 a RF-6 |

## 4. Decisões técnicas

### D-1: compilação síncrona com timeout por etapa
- **Escolha:** `pipeline.compilar` chama `matiec.compile_st_to_c` com
  `timeout=compile_timeout_matiec_s` (30 s) e, se ok, `esp32.build_firmware`
  com `timeout=compile_timeout_esp32_s` (300 s). O endpoint é `def` (não
  `async def`) para que o FastAPI o rode em *threadpool*, sem bloquear o
  *event loop* durante os até 300 s do build.
- **Alternativas descartadas:** endpoint `async def` chamando
  `run_in_threadpool` explicitamente — equivalente em efeito, mas o FastAPI já
  faz isso automaticamente para `def`, então a versão explícita só
  acrescentaria código sem ganho.
- **Requisito atendido:** RF-2, RF-3, RF-4, Q-6.

### D-2: `threading.Lock` de módulo serializa o diretório de trabalho
- **Escolha:** `pipeline.py` mantém um `Lock` a nível de módulo, mantido preso
  durante toda a chamada de `compilar()`. Suficiente porque o contrato é
  síncrono: não há fila, só "uma compilação de cada vez".
- **Alternativas descartadas:** lock só ao redor da chamada ao `esp32.py`
  (deixaria duas chamadas ao `matiec.py` correrem em paralelo, o que é seguro
  — cada uma usa seu próprio `TemporaryDirectory` — mas complicaria o
  raciocínio sobre o pipeline como uma seção crítica única, sem ganho de
  desempenho real dado que o passo caro é o `idf.py build`).
- **Requisito atendido:** Q-6, consequência (a).

### D-3: envelope de erro como exceção + *exception handler*
- **Escolha:** `ErroCompilacaoHTTP(status_code, envelope)` é levantada pela
  dependência de tamanho e pelo endpoint; um `@app.exception_handler` em
  `main.py` a serializa como `JSONResponse(status_code, envelope.model_dump())`.
- **Alternativas descartadas:** `HTTPException(status_code, detail=envelope)`
  — mais simples, mas o FastAPI embrulha `detail` num campo `{"detail": ...}`,
  o que quebraria o contrato Q-3 (`stage`/`code`/`message` no nível raiz do
  JSON).
- **Requisito atendido:** RF-8, Q-3.

### D-4: validação de tamanho e mapeamento de erro como peças reutilizáveis
- **Escolha:** `checar_tamanho_corpo` (dependência FastAPI) e `mapear_falha`
  (função pura `FalhaCompilacao -> ErroCompilacaoHTTP`) vivem em
  `api/compile.py`, exportadas para a S2 importar sem duplicar lógica.
- **Alternativas descartadas:** módulo `api/_contrato.py` compartilhado —
  cogitado, mas prematuro para duas funções; se um terceiro endpoint
  aparecer, vale extrair.
- **Requisito atendido:** RF-7, RF-8, preparação para `POST /compile/pacote`.

### D-5: diagnóstico por regex sobre saída capturada primeiro
- **Escolha:** a fixture real do `iec2c` foi capturada (`iec2c -f` para três
  casos de ST inválido) antes de qualquer linha de regex ser escrita. O
  formato confirmado é
  `<arquivo>:<linha>-<coluna>..<linha_fim>-<coluna_fim>: <severidade>: <mensagem>`,
  sempre em `stderr` nos três casos capturados.
- **Alternativas descartadas:** inferir o formato da documentação do MATIEC —
  descartado porque o plano exige a saída real como fonte da verdade; formato
  de mensagem de compilador é historicamente inconsistente entre versões.
- **Requisito atendido:** RF-8, Q-3 (`diagnostics[]`, `line`/`column`).

## 5. Contratos (API / dados / mensagens)

Ver a seção "Contrato fixado" do plano de implementação aprovado (idêntica
aqui, é a fonte única):

**Requisição (`POST /compile` e, na S2, `POST /compile/pacote`):**
`Content-Type: application/json`, corpo `{"source": "<texto ST>"}`.

**Limite do corpo (Q-2 = 262 144 bytes):** conferido por `Content-Length` e
pelo corpo lido, antes de qualquer compilação. Acima do limite: `413`.

**Sucesso de `POST /compile`:** `200`, `application/octet-stream`,
`Content-Disposition: attachment; filename="ladderflow_plc.bin"`.

**Erro (envelope Q-3, revisado):**
```json
{
  "stage": "request" | "matiec" | "esp32",
  "code": "compile_error" | "toolchain_error" | "timeout" | "payload_too_large",
  "message": "mensagem curta",
  "diagnostics": [{"file": "...", "line": 12, "column": 5, "severity": "error", "message": "..."}],
  "raw": {"stdout": "...", "stderr": "..."}
}
```

| Situação | HTTP | stage | code |
|---|---|---|---|
| corpo > 256 KiB | 413 | `request` | `payload_too_large` |
| ST inválido (iec2c rc≠0) | 422 | `matiec` | `compile_error` |
| C não compila / idf.py rc≠0 | 500 | `esp32` | `compile_error` |
| iec2c/idf.py ausente, falha de SO | 503 | etapa | `toolchain_error` |
| timeout de etapa | 504 | etapa | `timeout` |

JSON malformado continua sendo o `422` padrão do FastAPI/Pydantic — não é
recapturado pelo envelope Q-3.

## 6. Estratégia de testes

- **Unidade:** `test_parse_diagnostics` sobre as fixtures reais de
  `backend/tests/fixtures/iec2c_saidas/` (3 casos: erro de sintaxe, variável
  não declarada, tipo incompatível), mais casos de entrada vazia/linha não
  reconhecida (lista vazia, nunca exceção).
- **Contrato (rápido, `monkeypatch` nos adaptadores):** sucesso devolve
  octet-stream; ST inválido devolve 422 com `diagnostics` populado; corpo
  acima do limite devolve 413 sem chamar `matiec.compile_st_to_c` (espião);
  timeout do matiec e do esp32 devolvem 504 com a `stage` certa; toolchain
  ausente devolve 503; falha de link no esp32 devolve 500.
- **Integração real (pula fora do container):** `POST /compile` com ST
  inválido de verdade, contra o `iec2c` real — confirma que o parser lida com
  a saída de produção, não só com a fixture congelada.
- **Ponta a ponta (`slow`):** `POST /compile` com `blink.st` real, toolchain
  completa, binário não vazio devolvido.
- **Manual/hardware:** fora do escopo da S1 (sem endpoint de gravação ainda);
  CA-4 fica para S2 (QEMU) e para a bancada física, quando houver ESP32.
- **Mapeamento CA → teste:** CA-1/CA-2 (compilação com sucesso) →
  `test_compile_sucesso_devolve_binario`,
  `test_compile_ponta_a_ponta_blink`; CA-3/CA-6 (ST inválido) →
  `test_compile_st_invalido_devolve_422_com_diagnostics`,
  `test_compile_st_invalido_real_iec2c`; CA-5 (corpo grande) →
  `test_compile_payload_acima_do_limite_nao_chama_iec2c`. CA-4 (gravação) não
  é coberto pela S1 — é RF-5/RF-6, entregue na S2/S3.

## 7. Riscos e mitigações

| Risco | Impacto | Probabilidade | Mitigação |
|---|---|---|---|
| Formato de erro do `iec2c` muda entre versões/pinagens futuras | médio (diagnostics vazio) | baixa | Parser é best-effort por design; `raw` sempre íntegro, nada quebra |
| Duas requisições concorrentes disputam o diretório de build | médio (build corrompido) | baixa nesta fase (sem carga real) | `threading.Lock` de módulo (D-2); fila fica para depois se a concorrência virar problema real |
| Build frio (66 s) e timeout do esp32 (300 s) parecerem folgados demais/de menos em VPS mais lenta | baixo | média | Timeout é valor de config, não constante espalhada — ajustável sem mudar contrato |
| S2 e S3 divergirem do contrato fixado aqui | alto (retrabalho) | baixa | Contrato é este documento; nenhuma das duas sprints paralelas o edita |

## 8. Sequência de entrega em fatias

1. **S1 — `POST /compile`** (este documento cobre por inteiro): parser de
   diagnóstico, pipeline, endpoint, testes de contrato, documentação e
   depósito. Fecha RF-1 a RF-4, RF-7, RF-8, RF-9 e Q-2.
2. **S2 — gravação, camada servidor:** `flash_manifest`, `POST /compile/pacote`,
   validação de gravação real via `esptool`/QEMU por socket. Fecha a metade
   servidor de RF-5/RF-6.
3. **S3 — gravação no navegador + tela mínima:** `gravador.ts` sobre
   `esptool-js`, componentes React, testes com `vitest`. Fecha RF-1, RF-5,
   RF-6 na camada do navegador e CA-1 a CA-3, CA-5, CA-6 de ponta a ponta no
   produto (CA-4 só fecha de verdade com ESP32 físico).

## 9. Impacto na Constituição

- **§2 (fatia vertical):** a S1 é a metade servidor da fatia; nenhuma decisão
  aqui introduz algo mais fino que atravesse menos camada.
- **§6 (separação servidor/cliente):** `pipeline.py` não chama `subprocess`
  diretamente — delega às duas fronteiras existentes; o servidor continua sem
  estado entre requisições (Q-6).
- **§7 (segurança):** o limite de corpo (Q-2) é a primeira barreira de abuso
  do serviço; autenticação/rate-limit seguem fora de escopo (§7 da spec),
  registrados como pré-requisito de VPS em `state.md`.
- Nenhuma tensão nova com a Constituição foi identificada nesta sprint.
