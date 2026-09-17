/**
 * Área central da IDE (spec 002, plano D-13): mostra a aba ativa — Ladder
 * (editor controlado, sem tabela dentro; a tabela de variáveis mora no
 * painel lateral) ou ST (editor de texto + painel de erro). O diagrama e o
 * texto ST moram em `App` — trocar de aba só troca a apresentação, nunca
 * perde estado.
 */
import EditorST from '../EditorST'
import PainelErro from '../PainelErro'
import EditorLadder from '../ladder/EditorLadder'
import type { ErroCompilacao, ErroHttpCompilacao, ErroRedeCompilacao } from '../../lib/api'
import type { Diagrama } from '../../ladder/modelo'
import type { Aba } from './BarraSuperior'

type ErroDeCompilacao = ErroCompilacao | ErroHttpCompilacao | ErroRedeCompilacao

export interface AreaEditorProps {
  aba: Aba
  diagrama: Diagrama
  aoMudarDiagrama: (diagrama: Diagrama) => void
  fonte: string
  aoMudarFonte: (fonte: string) => void
  compilando: boolean
  erroCompilacao: ErroDeCompilacao | null
}

export default function AreaEditor({
  aba,
  diagrama,
  aoMudarDiagrama,
  fonte,
  aoMudarFonte,
  compilando,
  erroCompilacao,
}: AreaEditorProps) {
  return (
    <div className="min-w-0 flex-1 overflow-auto bg-ide-fundo p-4">
      {aba === 'ladder' && (
        <div id="painel-ladder" role="tabpanel" aria-labelledby="aba-ladder" className="h-full">
          <EditorLadder diagrama={diagrama} aoMudar={aoMudarDiagrama} />
        </div>
      )}

      {aba === 'st' && (
        <div id="painel-st" role="tabpanel" aria-labelledby="aba-st" className="flex h-full flex-col gap-4">
          <EditorST value={fonte} onChange={aoMudarFonte} disabled={compilando} />
          {erroCompilacao && <PainelErro erro={erroCompilacao} />}
        </div>
      )}
    </div>
  )
}
