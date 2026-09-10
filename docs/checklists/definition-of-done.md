# Definition of Done

Uma tarefa (`#N` do `tasks.md`) só é marcada `[x]` quando **todos** os itens
abaixo valem. Uma feature (spec `NNN`) só é "pronta" quando todas as suas
tarefas estão concluídas e a seção de feature abaixo vale.

---

## Por tarefa

- [ ] O critério de "Pronto quando" da tarefa é satisfeito e foi verificado.
- [ ] Código novo segue o estilo da vizinhança (nomes, comentários, idiomas) — §11.
- [ ] Testes automatizados cobrindo o comportamento da tarefa; passam localmente — §4.
- [ ] Lint/formatador do projeto sem erros nos arquivos tocados.
- [ ] Nenhum comportamento fora do `plan.md` foi introduzido.
- [ ] Sem segredos, credenciais ou caminhos absolutos de máquina no diff.
- [ ] Commit referencia `spec NNN` e `tarefa #N` — §8.

## Por feature

- [ ] Todos os critérios de aceitação (CA-n) da spec verificados — automatizado
      onde possível, manual (com registro) onde exige hardware.
- [ ] O ST gerado relevante compila no `iec2c` sem erro — §3.
- [ ] Caminho fim-a-fim demonstrado (editar/entrada → compilar → gravar), ainda
      que na fatia mínima — §2.
- [ ] `context/*.md` e o `README.md` atualizados se a feature mudou arquitetura,
      stack ou escopo.
- [ ] A tabela de rastreabilidade do `tasks.md` está completa.
- [ ] O trio `spec.md` / `plan.md` / `tasks.md` descreve fielmente o que foi
      construído (serve de base para o TCC).
