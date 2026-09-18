/**
 * Área central da IDE (spec 002, tarefa #26; painel de variáveis devolvido
 * ao lateral na revisão da mesma tarefa): mostra o conteúdo de edição para o
 * `projeto` atual — LD mostra sempre o `EditorLadder` (as variáveis vivem no
 * `PainelLateral`, ao lado, montado por `App`); ST mostra o `EditorST` +
 * `PainelErro`. O `projeto` inteiro mora em `App`; este componente só decide
 * o que mostrar e traduz a edição de volta para `aoMudarProjeto` (sempre o
 * projeto completo, imutável — nunca um `Diagrama` ou uma `fonte` soltos,
 * para não vazar o formato de armazenamento de volta pra fora de
 * `projeto/projeto.ts`).
 *
 * `problemas`/`foco` (herdado da tarefa #13): `App` calcula `validarDiagrama`
 * (só faz sentido em LD; ST não tem diagrama) e repassa aqui; `foco` é o
 * pedido de "ir até a célula" que nasce de um clique em `ListaProblemas`.
 */
import EditorST from '../EditorST'
import PainelErro from '../PainelErro'
import EditorLadder from '../ladder/EditorLadder'
import type { ErroCompilacao, ErroHttpCompilacao, ErroRedeCompilacao } from '../../lib/api'
import type { Problema } from '../../ladder/validacao'
import type { Projeto } from '../../projeto/projeto'

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
  projeto: Projeto
  /** Recebe o projeto inteiro já atualizado (diagrama ou fonte trocados,
   * conforme a linguagem) — quem decide como persistir é `App`. */
  aoMudarProjeto: (projeto: Projeto) => void
  problemas: Problema[]
  foco: FocoLadder | null
  compilando: boolean
  erroCompilacao: ErroDeCompilacao | null
  /** Recusa de uma jogada do editor Ladder (tarefas #25/#26, revisado na
   * #27): a IDE mostra o motivo como um toast no canto da tela, em vez do
   * editor mostrar o texto sozinho. Repassado cru a `EditorLadder`. */
  aoRecusar: (motivo: string) => void
}

export default function AreaEditor({ projeto, aoMudarProjeto, problemas, foco, compilando, erroCompilacao, aoRecusar }: AreaEditorProps) {
  return (
    <div className="min-w-0 flex-1 overflow-auto bg-ide-fundo p-4">
      {projeto.linguagem === 'ld' && (
        <EditorLadder
          diagrama={projeto.diagrama}
          aoMudar={(diagrama) => aoMudarProjeto({ ...projeto, diagrama })}
          problemas={problemas}
          foco={foco}
          aoRecusar={aoRecusar}
        />
      )}

      {projeto.linguagem === 'st' && (
        <div className="flex h-full flex-col gap-4">
          <EditorST value={projeto.fonte} onChange={(fonte) => aoMudarProjeto({ ...projeto, fonte })} disabled={compilando} />
          {erroCompilacao && <PainelErro erro={erroCompilacao} />}
        </div>
      )}
    </div>
  )
}
