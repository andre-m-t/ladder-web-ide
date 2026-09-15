# CLAUDE.md — LadderFlow

Instruções para agentes de IA que trabalham neste repositório.

Este arquivo carrega apenas as **regras operacionais** do projeto. As convenções
de código e de stack continuam em `docs/context/tech-stack.md`, e o método de
desenvolvimento em `docs/workflow.md` e `docs/constitution.md` — este arquivo
aponta para eles, não os duplica.

---

## Regra 1 — `.claude/state.md` é atualizado em toda rodada

`.claude/state.md` é a fotografia em tempo real do projeto: features, status,
decisões em aberto, próximos passos e histórico de rodadas.

**Leia-o antes de começar qualquer trabalho** — é o que diz onde o projeto está
sem precisar reconstruir a partir de specs e `git log`.

**Atualize-o antes de terminar**, e **no mesmo commit** da mudança que o afeta.
Vale para ciclo completo e para caminho curto, para código e para documentação.
O próprio arquivo lista, no topo, os cinco pontos a revisar.

Isto não é cerimônia: o documento é insumo direto do TCC e sustenta a
rastreabilidade da autoria. Um `state.md` que afirma algo já sabidamente falso é
pior que nenhum, porque é lido como verdade — se uma pendência foi resolvida na
rodada, ela sai de "Falta"; se surgiu uma nova, ela entra.

Não peça permissão para atualizá-lo. Faz parte da tarefa, como o teste faz.

## Regra 2 — o método SDD tem portões

Quatro fases (`/especificar` → `/planejar` → `/tarefas` → `/implementar`), cada
uma liberada por aprovação explícita do autor. Mudanças pequenas e de baixo
risco seguem o **caminho curto**, sem specs — o critério objetivo está em
`docs/workflow.md`. Na dúvida, trate como ciclo completo.

Decisão já registrada em uma spec **não se apaga**: revisões são aditivas e
datadas, porque o histórico é matéria-prima do capítulo de Desenvolvimento.

## Regra 3 — rastreabilidade em cada commit

Todo commit referencia a spec (`spec NNN`) e, quando houver, a tarefa (`#N`).
Commit e push só quando o autor pedir.

## Regra 4 — propriedade intelectual

O projeto será depositado no INPI. Antes de mover, renomear ou acrescentar
código autoral, confira `scripts/build-deposito.sh`: o manifesto `REQUIRED_FILES`
precisa acompanhar. Rode `bash scripts/build-deposito.sh --verificar` — ele falha
se código autoral sumir do pacote ou se artefato de terceiro entrar na árvore.

Código de terceiros nunca é copiado para dentro do repositório. `iec2c` e
`idf.py` são processos externos, isolados cada um em seu adaptador
(`backend/app/services/`). Componentes novos entram em `THIRD_PARTY.md`,
identificados sem descrição de implementação, conforme orientação do INPI.

## Regra 5 — ambiente

Não suba `docker compose up` sem necessidade: as portas 8000 e 5173 estão
ocupadas por outros projetos nesta máquina. Para rodar testes, prefira um
contêiner avulso sem publicar portas:

```bash
docker run --rm -v "$(pwd):/repo" -w /repo/backend ladderflow-backend:dev \
  python -m pytest -m "not slow" -q
```

O host não tem `python` nem `pytest` instalados — isso é proposital.
