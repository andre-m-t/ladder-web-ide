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
 */
import { useState } from 'react'

import { atualizarVariavel, declararVariavel, removerVariavel, type ResultadoEdicao } from '../../ladder/edicao'
import type { Diagrama } from '../../ladder/modelo'
import TabelaVariaveis from './TabelaVariaveis'

export interface PainelVariaveisProps {
  diagrama: Diagrama
  aoMudar: (d: Diagrama) => void
}

export default function PainelVariaveis({ diagrama, aoMudar }: PainelVariaveisProps) {
  const [erro, setErro] = useState<string | null>(null)

  function aplicar(resultado: ResultadoEdicao) {
    if (resultado.ok) {
      setErro(null)
      aoMudar(resultado.diagrama)
    } else {
      setErro(resultado.motivo)
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
      <TabelaVariaveis
        variaveis={diagrama.variaveis}
        erro={erro}
        aoDeclarar={aoDeclarar}
        aoAtualizar={aoAtualizar}
        aoRemover={aoRemover}
      />
    </div>
  )
}
