# Plano — Spec 006

## Fatias

1. Unificação `ElementoBloco`, `blocos.ts`, migração v2, CTU inalterado em `Q`.
2. TON ponta a ponta + relógio host + diferencial.
3. TOF (máquina MATIEC, `Q := IN OR (STATE=1)` no fim).
4. CTD (`LD` na linha de controle, piso 0, `Q` na partida).
5. Acabamento UI (CV/ET, rótulos acessíveis), docs, manifesto INPI, `state.md`.

## Verificação

```bash
cd frontend && npx tsc --noEmit && npx vitest run
docker run --rm -v "$(pwd):/repo" -w /repo/backend ladderflow-backend:dev \
  python -m pytest -m "not slow" -q
bash scripts/build-deposito.sh --verificar
```
