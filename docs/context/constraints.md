# Escopo, limitações e restrições — LadderFlow

Lido pela IA em todas as fases. Uma feature que viole um item aqui está fora de
escopo até a restrição ser revista explicitamente com o autor.

---

## Escopo do produto

**Dentro:**
- Editor visual Ladder (contatos, bobinas) no navegador.
- Serialização do diagrama para Structured Text.
- Simulador de ciclo de varredura no cliente.
- Compilação remota de ST para firmware ESP32.
- Gravação do firmware no ESP32 pelo navegador.
- Um **subconjunto** dos elementos da IEC 61131-3, declarado por spec.

**Fora:**
- Cobertura completa da IEC 61131-3.
- Linguagens FBD, SFC, IL (foco em LD e ST).
- Interface para I/O industrial de campo (24 V, relés de potência, barramentos).
- Requisitos de segurança funcional (SIL / IEC 61508).
- Variantes do ESP32 além do clássico.
- Colaboração multiusuário, contas, persistência em nuvem (salvo spec futura explícita).
- Depuração on-target (breakpoints no dispositivo).

## Restrições técnicas

| Restrição | Detalhe | Origem |
|---|---|---|
| Navegador | Chrome/Edge 89+; Web Serial API obrigatória | §5, README |
| Contexto de execução | HTTPS ou `localhost` — sem exceção | §7 |
| Nível elétrico | Lógica 3,3 V / GPIO; sem interface de potência | §7, §9 |
| Alvo de hardware | ESP32 clássico apenas | §9, README |
| Sem instalação local | Nenhum toolchain, driver ou app no cliente | §5 |
| Servidor sem estado | Não persiste projetos do usuário | §6 |
| MATIEC | Processo externo, GPL isolada em contêiner | §10 |

## Restrições de propriedade intelectual

- Software em **registro no INPI** (Lei 9.609/1998). Até a conclusão, **todos os
  direitos reservados**; nenhum arquivo declara licença de uso.
- Termos de licenciamento definidos depois, com o NIT.
- Componentes de terceiros e suas licenças: ver [`../../THIRD_PARTY.md`](../../THIRD_PARTY.md).
- O repositório versiona todo o material do projeto, inclusive `docs/` e
  `.claude/`. O pacote de **depósito** no INPI é gerado à parte por
  `scripts/build-deposito.sh`, que inclui apenas código-fonte autoral.

## Restrições de processo

- Toda feature passa por `spec → plan → tasks → código` com aprovação humana
  entre fases (ver [`../workflow.md`](../workflow.md)).
- Commits e PRs referenciam a spec e a tarefa (§8).
- Caráter acadêmico: decisões devem ser defensáveis na escrita do TCC —
  registre o "porquê", não só o "o quê".
