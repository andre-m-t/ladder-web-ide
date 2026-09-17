/**
 * Área central da IDE (spec 002, tarefa #26): mostra o conteúdo da sub-aba de
 * edição ativa para o `projeto` atual — LD tem duas sub-abas ("Lógica":
 * `EditorLadder`; "Variáveis": `PainelVariaveis`), ST tem só uma ("Lógica":
 * `EditorST` + `PainelErro`). O `projeto` inteiro mora em `App`; este
 * componente só decide o que mostrar e traduz a edição de volta para
 * `aoMudarProjeto` (sempre o projeto completo, imutável — nunca um `Diagrama`
 * ou uma `fonte` soltos, para não vazar o formato de armazenamento de volta
 * pra fora de `projeto/projeto.ts`).
 *
 * Os `id`/`aria-labelledby` de cada painel casam com o que `BarraSuperior`
 * emite nas sub-abas (`aba-edicao-logica`/`aba-edicao-variaveis`): o projeto
 * ST só usa `painel-edicao-logica`, porque não tem sub-aba Variáveis
 * (`BarraSuperior` não a mostra para `linguagem !== 'ld'`) — por isso
 * `abaEdicao` só importa mesmo em projeto LD.
 *
 * `problemas`/`foco` (herdado da tarefa #13): `App` calcula `validarDiagrama`
 * (só faz sentido em LD; ST não tem diagrama) e repassa aqui; `foco` é o
 * pedido de "ir até a célula" que nasce de um clique em `ListaProblemas`.
 */
import EditorST from '../EditorST'
import PainelErro from '../PainelErro'
import EditorLadder from '../ladder/EditorLadder'
import PainelVariaveis from '../ladder/PainelVariaveis'
import type { ErroCompilacao, ErroHttpCompilacao, ErroRedeCompilacao } from '../../lib/api'
import type { Problema } from '../../ladder/validacao'
import type { Projeto } from '../../projeto/projeto'
import type { AbaEdicao } from './BarraSuperior'

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
  /** Sub-aba ativa (`BarraSuperior`, tarefa #26) — só distingue algo em
   * projeto LD; em ST sempre mostra o editor de texto (única sub-aba). */
  abaEdicao: AbaEdicao
  /** Recebe o projeto inteiro já atualizado (diagrama ou fonte trocados,
   * conforme a linguagem) — quem decide como persistir é `App`. */
  aoMudarProjeto: (projeto: Projeto) => void
  problemas: Problema[]
  foco: FocoLadder | null
  compilando: boolean
  erroCompilacao: ErroDeCompilacao | null
  /** Recusa de uma jogada do editor Ladder ou do painel de variáveis (tarefas
   * #25/#26): a IDE mostra o motivo na aba Mensagens, em vez do editor
   * mostrar o texto sozinho. Repassado cru a `EditorLadder`/`PainelVariaveis`. */
  aoRecusar: (motivo: string) => void
}

export default function AreaEditor({
  projeto,
  abaEdicao,
  aoMudarProjeto,
  problemas,
  foco,
  compilando,
  erroCompilacao,
  aoRecusar,
}: AreaEditorProps) {
  return (
    <div className="min-w-0 flex-1 overflow-auto bg-ide-fundo p-4">
      {projeto.linguagem === 'ld' && abaEdicao === 'logica' && (
        <div id="painel-edicao-logica" role="tabpanel" aria-labelledby="aba-edicao-logica" className="h-full">
          <EditorLadder
            diagrama={projeto.diagrama}
            aoMudar={(diagrama) => aoMudarProjeto({ ...projeto, diagrama })}
            problemas={problemas}
            foco={foco}
            aoRecusar={aoRecusar}
          />
        </div>
      )}

      {projeto.linguagem === 'ld' && abaEdicao === 'variaveis' && (
        <div id="painel-edicao-variaveis" role="tabpanel" aria-labelledby="aba-edicao-variaveis" className="h-full">
          <PainelVariaveis
            diagrama={projeto.diagrama}
            aoMudar={(diagrama) => aoMudarProjeto({ ...projeto, diagrama })}
            aoRecusar={aoRecusar}
          />
        </div>
      )}

      {projeto.linguagem === 'st' && (
        <div id="painel-edicao-logica" role="tabpanel" aria-labelledby="aba-edicao-logica" className="flex h-full flex-col gap-4">
          <EditorST value={projeto.fonte} onChange={(fonte) => aoMudarProjeto({ ...projeto, fonte })} disabled={compilando} />
          {erroCompilacao && <PainelErro erro={erroCompilacao} />}
        </div>
      )}
    </div>
  )
}
