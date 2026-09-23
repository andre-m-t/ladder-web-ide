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
 *
 * `congelado`/`simulacao` (spec 004, tarefa #11, RF-15, D-9): simples
 * passagem cega até `EditorLadder`, dono de verdade das duas props — `App`
 * (dona do relógio/modo de simulação) decide os valores, este componente só
 * repassa, sem interpretar. Sem mudança nenhuma para o lado ST (a simulação
 * é fora de escopo em Texto Estruturado, RF-16/Q-6).
 */
import EditorST from '../EditorST'
import PainelErro from '../PainelErro'
import EditorLadder from '../ladder/EditorLadder'
import type { PontoAmbiente } from '../../ambientes/contrato'
import type { ErroCompilacao, ErroHttpCompilacao, ErroRedeCompilacao } from '../../lib/api'
import type { Problema } from '../../ladder/validacao'
import type { EnergizacaoDegrau } from '../../ladder/simulacao'
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
  /** Simulação ativa (spec 004, RF-15, D-9): congela `EditorLadder` — sem
   * efeito em projeto ST. */
  congelado?: boolean
  /** Energização por degrau da simulação em curso (RF-6, RF-14) — repassada
   * crua a `EditorLadder`; `null`/ausente é "sem simulação". */
  simulacao?: { energizacao: Record<string, EnergizacaoDegrau> } | null
  /** Pontos do ambiente aberto (spec 005, revisão 2026-09-23) — repassados
   * crus a `EditorLadder`, que os usa só para sugerir nome e rotular pinos
   * ao criar variável pelo elemento. */
  pontosAmbiente?: readonly PontoAmbiente[]
}

export default function AreaEditor({
  projeto,
  aoMudarProjeto,
  problemas,
  foco,
  compilando,
  erroCompilacao,
  aoRecusar,
  congelado,
  simulacao,
  pontosAmbiente,
}: AreaEditorProps) {
  return (
    <div className="min-w-0 flex-1 overflow-auto bg-ide-fundo p-4">
      {projeto.linguagem === 'ld' && (
        <EditorLadder
          diagrama={projeto.diagrama}
          aoMudar={(diagrama) => aoMudarProjeto({ ...projeto, diagrama })}
          problemas={problemas}
          foco={foco}
          aoRecusar={aoRecusar}
          congelado={congelado}
          simulacao={simulacao}
          pontosAmbiente={pontosAmbiente}
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
