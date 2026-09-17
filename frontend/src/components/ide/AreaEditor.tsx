/**
 * Área central da IDE (spec 002, plano D-13): mostra a aba ativa — Ladder
 * (editor controlado, sem tabela dentro; a tabela de variáveis mora no
 * painel lateral) ou ST (editor de texto + painel de erro). O diagrama e o
 * texto ST moram em `App` — trocar de aba só troca a apresentação, nunca
 * perde estado.
 *
 * `problemas`/`foco` (tarefa #13): `App` calcula `validarDiagrama` a cada
 * mudança e repassa aqui; `foco` é o pedido de "ir até a célula" que nasce de
 * um clique em `ListaProblemas` (token incremental para repetir o mesmo alvo
 * duas vezes seguidas). Contrato fixado com a frente que faz `EditorLadder`
 * — ver `EditorLadderProps`.
 */
import EditorST from '../EditorST'
import PainelErro from '../PainelErro'
import EditorLadder from '../ladder/EditorLadder'
import type { ErroCompilacao, ErroHttpCompilacao, ErroRedeCompilacao } from '../../lib/api'
import type { Diagrama } from '../../ladder/modelo'
import type { Problema } from '../../ladder/validacao'
import type { Aba } from './BarraSuperior'

type ErroDeCompilacao = ErroCompilacao | ErroHttpCompilacao | ErroRedeCompilacao

/** Pedido de foco num elemento do diagrama (tarefa #13, item 4): `token`
 * incrementa a cada escolha para que repetir o mesmo alvo (mesmo `rungId`
 * /`elementoId`) ainda dispare o efeito no `EditorLadder`. */
export interface FocoLadder {
  rungId: string
  elementoId: string | null
  token: number
}

export interface AreaEditorProps {
  aba: Aba
  diagrama: Diagrama
  aoMudarDiagrama: (diagrama: Diagrama) => void
  problemas: Problema[]
  foco: FocoLadder | null
  fonte: string
  aoMudarFonte: (fonte: string) => void
  compilando: boolean
  erroCompilacao: ErroDeCompilacao | null
  /** Recusa de uma jogada do editor Ladder (tarefa #25, contrato fixado com a
   * frente L): a IDE mostra o motivo na `BarraStatus` e no Console, em vez do
   * editor mostrar o texto sozinho. Repassado cru a `EditorLadder`. */
  aoRecusar: (motivo: string) => void
}

export default function AreaEditor({
  aba,
  diagrama,
  aoMudarDiagrama,
  problemas,
  foco,
  fonte,
  aoMudarFonte,
  compilando,
  erroCompilacao,
  aoRecusar,
}: AreaEditorProps) {
  return (
    <div className="min-w-0 flex-1 overflow-auto bg-ide-fundo p-4">
      {aba === 'ladder' && (
        <div id="painel-ladder" role="tabpanel" aria-labelledby="aba-ladder" className="h-full">
          <EditorLadder diagrama={diagrama} aoMudar={aoMudarDiagrama} problemas={problemas} foco={foco} aoRecusar={aoRecusar} />
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
