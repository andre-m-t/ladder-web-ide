/**
 * Conteúdo do painel inferior da IDE (spec 002, tarefa #26; spec 003, tarefa
 * #7): abas "Problemas", "ST gerado", "Mensagens" e "Console" no padrão ARIA
 * de tablist (`role="tablist"` / `tab` / `tabpanel`, `aria-selected`,
 * navegação por setas). O botão de recolher da `BarraSuperior` continua
 * agindo sobre o `PainelInferior` inteiro (`App.tsx`) — recolher esconde
 * todas as abas juntas, não só uma.
 *
 * A aba "ST gerado" (spec 003, plano D-9, Q-1) só existe num projeto Ladder:
 * a prop `stGerado` chega `undefined` num projeto ST, e nesse caso a aba nem
 * é renderizada nem entra na navegação por setas — a IDE nunca mostra uma
 * aba vazia. Quando presente, mostra o `ResultadoSerializacao` que o `App`
 * calcula a partir do diagrama (`VisualizacaoST`), atualizado a cada edição
 * porque quem recalcula é o `App`, não este componente.
 *
 * Defensivo: se `aba === 'st'` chegar sem `stGerado` (por exemplo, a
 * preferência de aba ficou salva de um projeto Ladder e o projeto atual
 * virou ST antes deste componente re-renderizar), o conteúdo cai para o
 * mesmo painel do Console, em vez de mostrar uma aba fantasma — o `App`
 * também garante isso ao trocar de projeto, mas este componente não confia
 * só nisso.
 *
 * A barra de status (`BarraStatus`) saiu (tarefa #26): a aba "Mensagens" é o
 * destino das mensagens que antes apareciam ali, com contagem de não lidas
 * na própria aba.
 *
 * Uma única lixeira "Limpar", à direita da faixa de abas, limpa o conteúdo
 * da aba ativa quando é Mensagens ou Console — some em Problemas e em ST
 * gerado, que não se "limpam" (são derivadas do diagrama).
 *
 * A aba ativa é decidida pelo `App` (preferência em `localStorage`, mesmo
 * padrão das outras preferências de layout) — este componente só recebe
 * `aba`/`aoMudarAba` e não guarda estado próprio, para caber no mesmo estilo
 * controlado do resto da IDE.
 */
import { useRef, type KeyboardEvent } from 'react'
import { FileCode, MessageSquare, SquareTerminal, Trash2, TriangleAlert } from 'lucide-react'

import type { EntradaConsole } from '../../lib/console'
import type { ResultadoSerializacao } from '../../ladder/serializador'
import type { Problema } from '../../ladder/validacao'
import Console from './Console'
import ListaMensagens from './ListaMensagens'
import ListaProblemas from './ListaProblemas'
import VisualizacaoST from './VisualizacaoST'

export type AbaInferior = 'problemas' | 'st' | 'mensagens' | 'console'

export interface PainelInferiorConteudoProps {
  aba: AbaInferior
  aoMudarAba: (aba: AbaInferior) => void
  problemas: Problema[]
  aoEscolherProblema: (problema: Problema) => void
  /** Resultado da serialização do diagrama, só num projeto Ladder. `undefined`
   * num projeto ST — nesse caso a aba "ST gerado" não é exibida. */
  stGerado?: ResultadoSerializacao
  mensagens: EntradaConsole[]
  naoLidasMensagens: number
  aoLimparMensagens: () => void
  entradasConsole: EntradaConsole[]
  aoLimparConsole: () => void
}

/** Ordem das abas quando "ST gerado" está presente (projeto Ladder). */
const ORDEM_ABAS_COM_ST: AbaInferior[] = ['problemas', 'st', 'mensagens', 'console']
/** Ordem das abas sem "ST gerado" (projeto ST) — usada pela navegação por
 * setas (com volta ao início/fim) em ambos os casos. */
const ORDEM_ABAS_SEM_ST: AbaInferior[] = ['problemas', 'mensagens', 'console']

function classeAbaInferior(ativa: boolean): string {
  return ativa
    ? 'flex items-center gap-1.5 rounded-md bg-ide-elevado px-2.5 py-1 text-xs font-medium text-ide-texto'
    : 'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs text-ide-suave hover:text-ide-texto'
}

export default function PainelInferiorConteudo({
  aba,
  aoMudarAba,
  problemas,
  aoEscolherProblema,
  stGerado,
  mensagens,
  naoLidasMensagens,
  aoLimparMensagens,
  entradasConsole,
  aoLimparConsole,
}: PainelInferiorConteudoProps) {
  const refProblemas = useRef<HTMLButtonElement | null>(null)
  const refST = useRef<HTMLButtonElement | null>(null)
  const refMensagens = useRef<HTMLButtonElement | null>(null)
  const refConsole = useRef<HTMLButtonElement | null>(null)
  const refs: Record<AbaInferior, typeof refProblemas> = {
    problemas: refProblemas,
    st: refST,
    mensagens: refMensagens,
    console: refConsole,
  }

  const abaSTPresente = stGerado !== undefined
  // Defensivo (ver JSDoc do módulo): uma aba 'st' sem stGerado não deve
  // navegar nem exibir como se existisse — cai para o console.
  const abaEfetiva = aba === 'st' && !abaSTPresente ? 'console' : aba
  const ordemAbas = abaSTPresente ? ORDEM_ABAS_COM_ST : ORDEM_ABAS_SEM_ST

  const erros = problemas.filter((problema) => problema.severidade === 'erro')

  function aoTeclarNaAba(evento: KeyboardEvent<HTMLButtonElement>) {
    if (evento.key !== 'ArrowLeft' && evento.key !== 'ArrowRight') return
    evento.preventDefault()
    const indiceAtual = ordemAbas.indexOf(abaEfetiva)
    const proximoIndice =
      evento.key === 'ArrowRight'
        ? (indiceAtual + 1) % ordemAbas.length
        : (indiceAtual - 1 + ordemAbas.length) % ordemAbas.length
    const proxima = ordemAbas[proximoIndice]
    aoMudarAba(proxima)
    refs[proxima].current?.focus()
  }

  function aoLimparAbaAtiva() {
    if (abaEfetiva === 'mensagens') aoLimparMensagens()
    else if (abaEfetiva === 'console') aoLimparConsole()
  }

  return (
    <div className="flex h-full flex-col bg-ide-painel">
      <div role="tablist" aria-label="Painel inferior" className="flex shrink-0 items-center gap-1 border-b border-ide-borda px-2 py-1">
        <button
          ref={refProblemas}
          type="button"
          role="tab"
          id="aba-inferior-problemas"
          aria-selected={aba === 'problemas'}
          aria-controls="painel-inferior-problemas"
          tabIndex={aba === 'problemas' ? 0 : -1}
          onClick={() => aoMudarAba('problemas')}
          onKeyDown={aoTeclarNaAba}
          className={classeAbaInferior(aba === 'problemas')}
        >
          <TriangleAlert aria-hidden="true" size={14} className={erros.length > 0 ? 'text-ide-perigo' : 'text-ide-suave'} />
          Problemas {problemas.length}
        </button>

        {abaSTPresente && (
          <button
            ref={refST}
            type="button"
            role="tab"
            id="aba-inferior-st"
            aria-selected={abaEfetiva === 'st'}
            aria-controls="painel-inferior-st"
            tabIndex={abaEfetiva === 'st' ? 0 : -1}
            onClick={() => aoMudarAba('st')}
            onKeyDown={aoTeclarNaAba}
            className={classeAbaInferior(abaEfetiva === 'st')}
          >
            <FileCode aria-hidden="true" size={14} className="text-ide-suave" />
            ST gerado
          </button>
        )}

        <button
          ref={refMensagens}
          type="button"
          role="tab"
          id="aba-inferior-mensagens"
          aria-selected={abaEfetiva === 'mensagens'}
          aria-controls="painel-inferior-mensagens"
          tabIndex={abaEfetiva === 'mensagens' ? 0 : -1}
          onClick={() => aoMudarAba('mensagens')}
          onKeyDown={aoTeclarNaAba}
          className={classeAbaInferior(abaEfetiva === 'mensagens')}
        >
          <MessageSquare aria-hidden="true" size={14} className="text-ide-previa" />
          <span>Mensagens</span>{' '}
          {naoLidasMensagens > 0 && (
            <span className="rounded-full bg-ide-destaque px-1.5 text-[10px] font-semibold text-ide-destaque-texto">
              {naoLidasMensagens}
            </span>
          )}
        </button>

        <button
          ref={refConsole}
          type="button"
          role="tab"
          id="aba-inferior-console"
          aria-selected={abaEfetiva === 'console'}
          aria-controls="painel-inferior-console"
          tabIndex={abaEfetiva === 'console' ? 0 : -1}
          onClick={() => aoMudarAba('console')}
          onKeyDown={aoTeclarNaAba}
          className={classeAbaInferior(abaEfetiva === 'console')}
        >
          <SquareTerminal aria-hidden="true" size={14} className="text-ide-suave" />
          Console
        </button>

        {abaEfetiva !== 'problemas' && abaEfetiva !== 'st' && (
          <button
            type="button"
            onClick={aoLimparAbaAtiva}
            title="Limpar"
            aria-label="Limpar"
            className="ml-auto flex items-center gap-1 rounded px-2 py-1 text-xs text-ide-suave hover:bg-ide-elevado hover:text-ide-texto"
          >
            <Trash2 aria-hidden="true" size={14} />
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1">
        {abaEfetiva === 'problemas' && (
          <div id="painel-inferior-problemas" role="tabpanel" aria-labelledby="aba-inferior-problemas" className="h-full">
            <ListaProblemas problemas={problemas} aoEscolher={aoEscolherProblema} />
          </div>
        )}
        {abaEfetiva === 'st' && stGerado !== undefined && (
          <div id="painel-inferior-st" role="tabpanel" aria-labelledby="aba-inferior-st" className="h-full">
            <VisualizacaoST resultado={stGerado} />
          </div>
        )}
        {abaEfetiva === 'mensagens' && (
          <div id="painel-inferior-mensagens" role="tabpanel" aria-labelledby="aba-inferior-mensagens" className="h-full">
            <ListaMensagens entradas={mensagens} />
          </div>
        )}
        {abaEfetiva === 'console' && (
          <div id="painel-inferior-console" role="tabpanel" aria-labelledby="aba-inferior-console" className="h-full">
            <Console entradas={entradasConsole} />
          </div>
        )}
      </div>
    </div>
  )
}
