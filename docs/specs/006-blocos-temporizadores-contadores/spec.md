# Spec 006 — Blocos TON, TOF e CTD

## Objetivo

Estender o editor Ladder, o serializador ST, o simulador de varredura e a
medição diferencial simulador × `plc_host_runner` com os function blocks IEC
61131-3 **TON**, **TOF** e **CTD**, unificando o CTU existente em
`ElementoBloco`.

## Decisões

- **Entradas estritas IEC:** `TON(IN, PT)` e `TOF(IN, PT)` sem linha de
  controle; reset/desreset pela própria `IN`. `CTD(CD, LD, PV)` com `LD` na
  linha de controle (mesma mecânica do `R` do CTU).
- **Tempo lógico:** 1 varredura = **20 ms** (`PERIODO_VARREDURA_MS`); no
  simulador `CURRENT_TIME = ciclo × 20 ms` no instante da escrita; `PT` em ms,
  múltiplo de 20 na UI.
- **Semântica de referência:** implementação MATIEC (`iec2c` commit
  `79410c7660cf337ec7991a167e53ef141a26caf9`, `lib/timer.txt`,
  `lib/counter.txt`, `lib/C/iec_std_FB_impl.h`) — máquinas TON/TOF com `Q` fora
  do ciclo da borda; CTD com `CV=0` e `Q` verdadeiro na partida; CTU com
  incremento só se `CV < PV`.
- **Persistência:** envelope de diagrama **versão 2**; migração v1 (`linhaReset`/`pv` → `linhaControle`/`preset`).
- **Host:** `plc_hal_stub_advance_us(plc_glue_cycle_time_us())` após cada scan no
  `plc_host_cycle_runner`, para `TON`/`TOF` medirem tempo no diferencial.

## Critérios de aceitação

- CA-1: fixtures `TON_ATRASO`, `TOF_RETARDO`, `CTD_DESCE` serializam, simulam e
  geram dourados JSON/ST.
- CA-2: `test_simulacao_diferencial.py` — 0 divergências simulador × host para
  `ton.st`, `tof.st`, `ctd.st` nos padrões de entrada definidos.
- CA-3: `test_plc_runtime_host.py` — `TON` com `PT=T#100ms` sobe `Q` no ciclo
  esperado (relógio stub avançando).
- CA-4: UI — paleta, `SimboloBloco`, preset via descritor; CV/ET ao vivo na
  simulação.
