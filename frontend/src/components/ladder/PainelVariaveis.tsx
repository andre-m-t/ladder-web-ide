/**
 * Painel de variáveis — container (spec 002, plano D-13, tarefa #23, frente V;
 * revisão tarefa #26, frente L).
 *
 * É quem fala com o núcleo (`ladder/edicao.ts`): chama `declararVariavel`,
 * `atualizarVariavel` e `removerVariavel` puros sobre `diagrama`, aplica
 * `aoMudar` no sucesso e guarda a recusa para exibir (limpa no próximo
 * sucesso). O conteúdo visual — cabeçalho, abas, tabela, linha de adicionar,
 * mapa de pinos — é todo de `TabelaVariaveis.tsx`; este componente só
 * orquestra.
 *
 * Tarefa #26: virou brevemente o conteúdo de uma aba "Variáveis" de largura
 * inteira; o autor testou e pediu de volta o painel lateral estreito
 * (`PainelLateral`, D-13, só em projeto Ladder) — quem monta o painel e
 * decide a largura é `components/ide/**`, fora desta frente. A assinatura de
 * props não muda: continua `{ diagrama, aoMudar, aoRecusar? }`, controlado.
 *
 * Substitui o antigo `PainelVariaveis.tsx` da tarefa #22 (apagado quando o
 * vínculo elemento↔variável migrou para o clique/`ModalVariavel`): este é um
 * componente novo, sem relação com aquele — não há mais vínculo aqui.
 *
 * **Nenhuma mensagem em texto (tarefa #25):** a recusa do núcleo (nome
 * duplicado, endereço em uso, variável ainda vinculada a um elemento...) não
 * é mais guardada em estado próprio nem exibida por `TabelaVariaveis`
 * (`role="alert"` removido de lá) — este componente só repassa o motivo à
 * prop `aoRecusar`, para quem monta a IDE decidir onde mostrar (barra de
 * status, Console). Sem `aoRecusar`, a recusa é ignorada visualmente (o
 * diagrama continua intacto do mesmo jeito, só não há mais para onde mandar
 * o motivo).
 *
 * **Simulação (spec 004, tarefa #12, RF-12/RF-13):** `valores`, `aoAcionar`
 * e `ciclo` são passagem cega até `TabelaVariaveis` — este componente não
 * decide nada sobre eles, só repassa; `App` (dono do modo/relógio de
 * simulação) decide os valores. Sem simulação ativa, os três ficam
 * ausentes/`undefined` e o comportamento é o de hoje.
 *
 * **Bloqueio de mutação durante a simulação (spec 002, revisão 2026-09-23 —
 * simetria com o contrato de E/S do ambiente e com `EditorLadder`):** até
 * esta revisão, este painel era a única superfície do app que ainda
 * liberava criar/renomear/repinar/remover variável com a simulação ativa
 * (assimetria registrada em `.claude/state.md` sob a F9). `simulacaoAtiva`
 * fecha essa lacuna: `TabelaVariaveis` desabilita os controles de mutação
 * (a leitura continua sempre disponível), e `aoDeclarar`/`aoAtualizar`/
 * `aoRemover` ganham a mesma guarda na origem, por defesa em profundidade —
 * o mesmo padrão de `aoDeclararVariavelAmbiente`/`aoCriarVariavelNoModal`
 * (`App.tsx`/`EditorLadder.tsx`), que checam a simulação antes do núcleo,
 * mesmo com o botão já desabilitado. A recusa vai por `aoRecusar`, como
 * qualquer outra recusa do núcleo — nenhum diagrama é tocado.
 */
import {
  atualizarVariavel,
  declararVariavel,
  removerVariavel,
  type ResultadoEdicao,
} from '../../ladder/edicao'
import type { Diagrama } from '../../ladder/modelo'
import TabelaVariaveis, {
  MOTIVO_SIMULACAO_CRIAR,
  MOTIVO_SIMULACAO_EDITAR,
  MOTIVO_SIMULACAO_REMOVER,
} from './TabelaVariaveis'

export interface PainelVariaveisProps {
  diagrama: Diagrama
  aoMudar: (d: Diagrama) => void
  /** Chamado a cada recusa do núcleo (nome duplicado, variável em uso...),
   * com o motivo em português — tarefa #25. Sem esta prop, a recusa não
   * aparece em lugar nenhum (não há mais estado/exibição interna). */
  aoRecusar?: (motivo: string) => void
  /** Estado ao vivo por variável — presente só com a simulação ativa (spec
   * 004, tarefa #12). */
  valores?: Record<string, boolean>
  /** Aciona uma entrada durante a simulação (RF-12) — `TabelaVariaveis`
   * decide sozinha que só entrada responde. */
  aoAcionar?: (nome: string, nivel: boolean) => void
  /** Ciclos decorridos da simulação (RF-13) — presente só com a simulação
   * ativa. */
  ciclo?: number
  /** Endereços de entrada comandados pela planta (spec 005, RF-8). */
  enderecosComandadosPelaPlanta?: readonly string[]
  motivoEntradaPlanta?: string
  /** Simulação ativa (spec 004, Q-7) — bloqueia criar, renomear, trocar pino
   * e remover, simétrico ao contrato de E/S do ambiente e ao congelamento do
   * editor (revisão 2026-09-23). Ausente/`false` é o comportamento de
   * sempre; a leitura nunca é bloqueada. */
  simulacaoAtiva?: boolean
}

export default function PainelVariaveis({
  diagrama,
  aoMudar,
  aoRecusar,
  valores,
  aoAcionar,
  ciclo,
  enderecosComandadosPelaPlanta,
  motivoEntradaPlanta,
  simulacaoAtiva,
}: PainelVariaveisProps) {
  function aplicar(resultado: ResultadoEdicao) {
    if (resultado.ok) {
      aoMudar(resultado.diagrama)
    } else {
      aoRecusar?.(resultado.motivo)
    }
  }

  function aoDeclarar(variavel: { nome: string; endereco?: string }) {
    if (simulacaoAtiva) {
      aoRecusar?.(MOTIVO_SIMULACAO_CRIAR)
      return
    }
    aplicar(declararVariavel(diagrama, variavel))
  }

  function aoAtualizar(nomeAtual: string, variavel: { nome: string; endereco?: string }) {
    if (simulacaoAtiva) {
      aoRecusar?.(MOTIVO_SIMULACAO_EDITAR)
      return
    }
    aplicar(atualizarVariavel(diagrama, nomeAtual, variavel))
  }

  function aoRemover(nome: string) {
    if (simulacaoAtiva) {
      aoRecusar?.(MOTIVO_SIMULACAO_REMOVER)
      return
    }
    aplicar(removerVariavel(diagrama, nome))
  }

  return (
    <div className="flex h-full flex-col">
      <TabelaVariaveis
        variaveis={diagrama.variaveis}
        valores={valores}
        aoAcionar={aoAcionar}
        ciclo={ciclo}
        aoDeclarar={aoDeclarar}
        aoAtualizar={aoAtualizar}
        aoRemover={aoRemover}
        enderecosComandadosPelaPlanta={enderecosComandadosPelaPlanta}
        motivoEntradaPlanta={motivoEntradaPlanta}
        simulacaoAtiva={simulacaoAtiva}
      />
    </div>
  )
}
