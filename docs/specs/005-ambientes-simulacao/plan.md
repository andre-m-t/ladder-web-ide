# Plano 005 — Ambientes de simulação acoplados ao ciclo de varredura

> **Status:** aprovado (2026-09-21)
> **Spec de origem:** `spec.md` (aprovada em 2026-09-21, Q-1 a Q-8 decididas)
> **Autor:** André  ·  **Data:** 2026-09-21

---

## 1. Resumo da abordagem

Núcleo puro em `frontend/src/ambientes/`: contrato de ambiente, planta do portão,
catálogo e vínculo endereço ↔ variável. A interface monta `JanelaFlutuante`,
`PainelAmbiente` e `CenaPortao` (SVG). `App.tsx` integra a planta **dentro** do
laço que já chama `executarCiclo` (um passo de planta por ciclo — D-6).

## 2. Reúso

| O que | Onde |
|---|---|
| Ciclo de varredura | `ladder/simulacao.ts` |
| Endereços 8+8 | `ladder/enderecos.ts` |
| Classe de variável | `classeDaVariavel` |
| Toasts / Console | `lib/toasts.ts`, `Console.tsx` |
| Pointer Events | padrão do `EditorLadder` |
| Diferencial | `diferencial/executores.py`, `test_simulacao_diferencial.py` |

## 3. Componentes

| Componente | Caminho | Novo |
|---|---|---|
| Contrato | `frontend/src/ambientes/contrato.ts` | sim |
| Planta portão | `frontend/src/ambientes/portao.ts` | sim |
| Catálogo | `frontend/src/ambientes/catalogo.ts` | sim |
| Vínculo | `frontend/src/ambientes/vinculo.ts` | sim |
| Testes núcleo | `frontend/src/ambientes/*.test.ts` | sim |
| Janela | `components/ambientes/JanelaFlutuante.tsx` | sim |
| Painel | `components/ambientes/PainelAmbiente.tsx` | sim |
| Cena | `components/ambientes/CenaPortao.tsx` | sim |
| Barra / App | `BarraSuperior.tsx`, `App.tsx` | alterado |
| Tabela | `TabelaVariaveis.tsx` | alterado |
| Fixture | `ladder/fixtures.ts`, dourados | alterado |
| Depósito | `build-deposito.sh` | alterado |
| e2e | `frontend/e2e/ambiente.spec.ts` | sim |

## 4. Decisões técnicas

- **D-1 — Contrato:** `DefinicaoAmbiente` com `criarEstado`, `avancar(estado, saidasPorEndereco)`, `acionarComando`, lista `pontos`.
- **D-2 — Planta pura:** `portao.ts` sem React; abertura 0–100; passo `PASSO_ABERTURA_POR_CICLO` calibrado (~2 px Java → escala normalizada).
- **D-3 — Catálogo:** array exportado; extensão futura = novo arquivo + entrada no catálogo (Q-7 spec 002).
- **D-4 — Vínculo:** `saidasDoEstado(diagrama, variaveis)` e `aplicarEntradasPlanta(diagrama, estado, mapa)`.
- **D-5 — Faixa FC:** superior NF quando abertura ≤ limiar aberto; inferior NA quando abertura ≥ limiar fechado.
- **D-6 — Laço App:** dentro do `for` de ciclos do rAF, após cada `executarCiclo`, `avancar` + merge entradas; falha → `rodando: false` + toast.
- **D-7 — Janela:** `fixed` + transform translate; resize pelo canto inferior direito; mínimo 320×240.
- **D-8 — Entradas bloqueadas:** prop `enderecosComandadosPelaPlanta` em `TabelaVariaveis`.
- **D-9 — Medição:** `PORTAO` em fixtures; `portao.toml` em `diferencial/fixtures/serializador/` ou pasta dedicada `ambientes/`.
- **D-10 — Depósito:** `contrato.ts`, `portao.ts`, `catalogo.ts`, `vinculo.ts`, `CenaPortao.tsx` em `REQUIRED_FILES`.

## 5. Contratos de dados

### Saídas para a planta

`Record<string, boolean>` chaveado por endereço (`%QX0.4` → true/false), derivado
do `EstadoSimulacao.variaveis` + tabela `diagrama.variaveis`.

### Entradas da planta

Mesmo formato; aplicadas via `estado.entradas[nome]` para cada variável de
entrada cujo `endereco` coincide.

### Estado da planta portão

```ts
{ abertura: number; motorDanificado: boolean; botoes: { open, stop, close } }
```

## 6. Testes

- **vitest:** física, sensores, conflito motor, botões, faixas FC.
- **dourados:** `portao.json`, `portao.st` via snapshot.
- **pytest:** cenário PORTAO no diferencial.
- **e2e:** abrir ambiente, simular, Open, ver progresso.

## 7. Fatias

- **S1:** núcleo + fixture + diferencial.
- **S2:** UI + integração App.
- **S3:** e2e + depósito + state.md.

## Revisão aditiva — 2026-09-21

- `ModalAmbiente` antes da janela; nome **Portão**; mapa `%IX0`/`%QX0` da revisão
  na spec; `CenaPortao` redesenhada (SVG autoral); correção do × em
  `JanelaFlutuante`; fixture `PORTAO` com NF; margem FC vs. batente do motor.
