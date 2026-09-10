# Arquitetura — LadderFlow

Contexto estável lido pela IA antes de especificar ou planejar. Reflete o
`README.md` na raiz; se divergir, o `README.md` prevalece e este arquivo deve
ser atualizado.

---

## Visão

Arquitetura **cliente-servidor**. O cliente executa integralmente no navegador.
Ao servidor cabe **exclusivamente** a compilação (cf. §6 da constituição).

```
Navegador (sem instalação)                    Serviço de compilação
┌────────────────────────────────┐            ┌───────────────────────────┐
│ Editor visual Ladder           │            │ API (FastAPI)             │
│      ↓                         │  ST        │      ↓                    │
│ Serializador Ladder → ST       │ ─────────► │ MATIEC / iec2c  (ST → C)  │
│      ↓                         │            │      ↓                    │
│ Simulador de ciclo de varredura│            │ Toolchain ESP32 (C → bin) │
│      ↓                         │  binário   │                           │
│ Gravação via Web Serial API    │ ◄───────── │                           │
└──────────────┬─────────────────┘            └───────────────────────────┘
               │ Web Serial
               ▼
            ESP32 (clássico)
```

## Fluxo de execução

1. O usuário constrói a lógica no **editor Ladder** (canvas interativo).
2. O diagrama é **serializado para Structured Text** (formato canônico da
   IEC 61131-3).
3. A lógica é validada no **simulador de ciclo de varredura**, no cliente.
4. O código ST é enviado ao servidor e **compilado** (MATIEC → C ANSI →
   firmware ESP32).
5. O binário retorna e é **gravado no ESP32** pelo navegador, via Web Serial API.

## Fronteiras e contratos

| Fronteira | Direção | Conteúdo |
|---|---|---|
| Cliente → Servidor | requisição | código Structured Text (texto) |
| Servidor → Cliente | resposta | firmware binário **ou** erros de compilação estruturados |
| Cliente → ESP32 | Web Serial | protocolo de bootloader do ESP32 (via esptool-js) |

O servidor é **sem estado**: não persiste projetos, não conhece o editor.

## Componentes previstos (a materializar via specs)

- `frontend/` — aplicação web: editor, serializador, simulador, gravação.
- `backend/` — API de compilação e integração com MATIEC.
- `docs/` — método de desenvolvimento, documentação técnica e resultados de validação.
- `scripts/` — utilitários do projeto (ex.: `build-deposito.sh`).
- `docker-compose.yml`, `.env.example` — orquestração local.

## Restrições de execução

- Navegador: Chrome ou Edge 89+ (Web Serial API).
- Contexto: HTTPS ou `localhost`.
- Hardware alvo: ESP32 clássico.
- Ambiente de dev: Docker + Docker Compose (MATIEC e toolchain vêm no contêiner).
