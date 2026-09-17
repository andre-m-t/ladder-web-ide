/**
 * Painel de variáveis — container (spec 002, plano D-13, tarefa #23, frente V).
 *
 * É quem fala com o núcleo (`ladder/edicao.ts`): chama `declararVariavel`,
 * `atualizarVariavel` e `removerVariavel` puros sobre `diagrama`, aplica
 * `aoMudar` no sucesso e guarda a recusa para exibir (limpa no próximo
 * sucesso). O conteúdo visual — cabeçalho, abas, formulário, lista, mapa de
 * pinos — é todo de `TabelaVariaveis.tsx`; este componente só orquestra e
 * ocupa a altura inteira do painel lateral da IDE (`PainelLateral`, D-13),
 * que decide a largura.
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
 */
import { atualizarVariavel, declararVariavel, removerVariavel, type ResultadoEdicao } from '../../ladder/edicao'
import type { Diagrama } from '../../ladder/modelo'
import TabelaVariaveis from './TabelaVariaveis'

export interface PainelVariaveisProps {
  diagrama: Diagrama
  aoMudar: (d: Diagrama) => void
  /** Chamado a cada recusa do núcleo (nome duplicado, variável em uso...),
   * com o motivo em português — tarefa #25. Sem esta prop, a recusa não
   * aparece em lugar nenhum (não há mais estado/exibição interna). */
  aoRecusar?: (motivo: string) => void
}

export default function PainelVariaveis({ diagrama, aoMudar, aoRecusar }: PainelVariaveisProps) {
  function aplicar(resultado: ResultadoEdicao) {
    if (resultado.ok) {
      aoMudar(resultado.diagrama)
    } else {
      aoRecusar?.(resultado.motivo)
    }
  }

  function aoDeclarar(variavel: { nome: string; endereco?: string }) {
    aplicar(declararVariavel(diagrama, variavel))
  }

  function aoAtualizar(nomeAtual: string, variavel: { nome: string; endereco?: string }) {
    aplicar(atualizarVariavel(diagrama, nomeAtual, variavel))
  }

  function aoRemover(nome: string) {
    aplicar(removerVariavel(diagrama, nome))
  }

  return (
    <div className="flex h-full flex-col">
      <TabelaVariaveis variaveis={diagrama.variaveis} aoDeclarar={aoDeclarar} aoAtualizar={aoAtualizar} aoRemover={aoRemover} />
    </div>
  )
}
