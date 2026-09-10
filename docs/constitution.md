# Constituição de Engenharia — LadderFlow

Princípios não-negociáveis do projeto. Toda spec, todo plano e todo trecho de
código devem respeitá-los. Quando um princípio conflitar com uma conveniência
de implementação, o princípio vence — ou a spec precisa mudar explicitamente.

Cada princípio tem um número estável; specs e planos podem citá-lo (ex.: "cf. §5").

---

## §1 — Especificação antes de código

Nenhuma linha de implementação sem uma `spec.md` aprovada. A ordem é sempre
`spec → plan → tasks → código`. Se a spec estiver errada, corrige-se a spec,
não o código. Ver [`workflow.md`](./workflow.md).

**Caminho curto.** Correções e mudanças que **não** alteram comportamento
observável, contratos de API ou formatos de dados, e que **não** criam
capacidade nova, podem seguir o *caminho curto* definido no
[`workflow.md`](./workflow.md), com registro mínimo no commit. Este princípio
permanece **integral** para qualquer mudança que altere comportamento
observável, um contrato/formato, ou introduza capacidade nova: para essas, não
há implementação sem `spec.md` aprovada.

## §2 — Fatia vertical primeiro

Entregar o caminho fim-a-fim mais fino que funcione antes de aprofundar
qualquer camada. Um pipeline estreito que compila e grava vale mais, nesta
etapa, do que um editor visual completo que não conecta em nada.

## §3 — Conformidade com a IEC 61131-3

O Structured Text (ST) produzido pelo serializador deve compilar no MATIEC
(`iec2c`) sem erros. O subconjunto suportado da norma é declarado
explicitamente em cada spec relevante — nunca implícito. Elementos fora do
subconjunto são recusados com mensagem clara, não silenciosamente ignorados.

## §4 — Testes como rede de segurança

O simulador de ciclo de varredura e o pipeline de compilação/gravação têm
cobertura de testes automatizados. Toda tarefa de implementação inclui os
testes correspondentes. Um bug corrigido ganha um teste de regressão.

## §5 — Cliente sem instalação

O editor e o simulador executam 100% no navegador. Nada que exija ao usuário
instalar toolchain de compilação, driver serial, extensão ou aplicativo local.
A gravação usa a Web Serial API nativa. Se uma feature quebrar essa premissa,
ela está fora de escopo até a premissa ser revista.

## §6 — Separação de responsabilidades

- **Cliente (navegador):** edição visual, serialização Ladder→ST, simulação,
  gravação via Web Serial.
- **Servidor:** exclusivamente a compilação ST → C → firmware.

O servidor não guarda estado de projeto do usuário nem executa lógica de
edição. O cliente não compila.

## §7 — Segurança de hardware e de contexto

Validação apenas em nível lógico (3,3 V, GPIO do ESP32). Interface para I/O
industrial de campo e requisitos de segurança funcional estão **fora de
escopo** e devem ser recusados. A Web Serial só opera em contexto seguro
(HTTPS ou `localhost`); o código não tenta contornar isso.

## §8 — Rastreabilidade

Todo commit e todo PR referenciam a spec (`spec NNN`) e a tarefa
(`tarefa #N`) que atendem. O histórico do projeto deve permitir reconstruir
"por que este código existe" a partir da spec.

## §9 — Alvo único e escopo acadêmico

O alvo é o **ESP32 clássico**. Outras variantes da família não são validadas.
O LadderFlow é prova de conceito acadêmica; não se posiciona como substituto
de ferramenta industrial certificada, e nenhuma spec deve sugerir o contrário.

## §10 — Propriedade intelectual e licenças de terceiros

- O MATIEC (GPL-3.0) é invocado como **processo externo**, nunca incorporado ao
  código-fonte deste projeto.
- Obrigações de conformidade GPL são tratadas na distribuição de imagens de
  contêiner, não misturando código.
- Enquanto o registro no INPI não conclui, **todos os direitos são reservados**;
  nenhum arquivo do projeto declara licença de uso sem alinhamento com o NIT da
  instituição.
- A documentação do método (`docs/`) e a configuração de ferramenta (`.claude/`)
  são versionadas normalmente. O depósito no INPI é um pacote de arquivos
  selecionados, montado por `scripts/build-deposito.sh` — a exclusão de material
  não-autoral é responsabilidade desse script, não do controle de versão.

## §11 — Simplicidade e legibilidade

Código novo imita o código ao redor: mesma nomenclatura, mesma densidade de
comentários, mesmos idiomas. Preferir reúso a reescrita. Uma solução mais
simples que atenda à spec vence uma mais geral que "pode ser útil depois".
