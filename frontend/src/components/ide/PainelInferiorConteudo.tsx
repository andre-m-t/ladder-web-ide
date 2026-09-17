/**
 * Conteúdo do painel inferior da IDE (spec 002, tarefa #26): três abas —
 * "Problemas", "Mensagens" e "Console" — no padrão ARIA de tablist
 * (`role="tablist"` / `tab` / `tabpanel`, `aria-selected`, navegação por
 * setas). O botão de recolher da `BarraSuperior` continua agindo sobre o
 * `PainelInferior` inteiro (`App.tsx`) — recolher esconde as três abas
 * juntas, não só uma.
 *
 * A barra de status (`BarraStatus`) saiu (tarefa #26): a aba "Mensagens" é o
 * novo destino das mensagens que antes apareciam ali, com contagem de não
 * lidas na própria aba.
 *
 * Uma única lixeira "Limpar", à direita da faixa de abas, limpa o conteúdo
 * da aba ativa quando é Mensagens ou Console — some quando a aba ativa é
 * Problemas, que não se "limpa" (é derivada do diagrama).
 *
 * A aba ativa é decidida pelo `App` (preferência em `localStorage`, mesmo
 * padrão das outras preferências de layout) — este componente só recebe
 * `aba`/`aoMudarAba` e não guarda estado próprio, para caber no mesmo estilo
 * controlado do resto da IDE.
 */
import { useRef, type KeyboardEvent } from 'react'
import { MessageSquare, SquareTerminal, Trash2, TriangleAlert } from 'lucide-react'

import type { EntradaConsole } from '../../lib/console'
import type { Problema } from '../../ladder/validacao'
import Console from './Console'
import ListaMensagens from './ListaMensagens'
import ListaProblemas from './ListaProblemas'

export type AbaInferior = 'problemas' | 'mensagens' | 'console'

export interface PainelInferiorConteudoProps {
  aba: AbaInferior
  aoMudarAba: (aba: AbaInferior) => void
  problemas: Problema[]
  aoEscolherProblema: (problema: Problema) => void
  mensagens: EntradaConsole[]
  naoLidasMensagens: number
  aoLimparMensagens: () => void
  entradasConsole: EntradaConsole[]
  aoLimparConsole: () => void
}

/** Ordem das abas — usada pela navegação por setas (com volta ao início/fim). */
const ORDEM_ABAS: AbaInferior[] = ['problemas', 'mensagens', 'console']

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
  mensagens,
  naoLidasMensagens,
  aoLimparMensagens,
  entradasConsole,
  aoLimparConsole,
}: PainelInferiorConteudoProps) {
  const refProblemas = useRef<HTMLButtonElement | null>(null)
  const refMensagens = useRef<HTMLButtonElement | null>(null)
  const refConsole = useRef<HTMLButtonElement | null>(null)
  const refs: Record<AbaInferior, typeof refProblemas> = {
    problemas: refProblemas,
    mensagens: refMensagens,
    console: refConsole,
  }

  const erros = problemas.filter((problema) => problema.severidade === 'erro')

  function aoTeclarNaAba(evento: KeyboardEvent<HTMLButtonElement>) {
    if (evento.key !== 'ArrowLeft' && evento.key !== 'ArrowRight') return
    evento.preventDefault()
    const indiceAtual = ORDEM_ABAS.indexOf(aba)
    const proximoIndice =
      evento.key === 'ArrowRight'
        ? (indiceAtual + 1) % ORDEM_ABAS.length
        : (indiceAtual - 1 + ORDEM_ABAS.length) % ORDEM_ABAS.length
    const proxima = ORDEM_ABAS[proximoIndice]
    aoMudarAba(proxima)
    refs[proxima].current?.focus()
  }

  function aoLimparAbaAtiva() {
    if (aba === 'mensagens') aoLimparMensagens()
    else if (aba === 'console') aoLimparConsole()
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

        <button
          ref={refMensagens}
          type="button"
          role="tab"
          id="aba-inferior-mensagens"
          aria-selected={aba === 'mensagens'}
          aria-controls="painel-inferior-mensagens"
          tabIndex={aba === 'mensagens' ? 0 : -1}
          onClick={() => aoMudarAba('mensagens')}
          onKeyDown={aoTeclarNaAba}
          className={classeAbaInferior(aba === 'mensagens')}
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
          aria-selected={aba === 'console'}
          aria-controls="painel-inferior-console"
          tabIndex={aba === 'console' ? 0 : -1}
          onClick={() => aoMudarAba('console')}
          onKeyDown={aoTeclarNaAba}
          className={classeAbaInferior(aba === 'console')}
        >
          <SquareTerminal aria-hidden="true" size={14} className="text-ide-suave" />
          Console
        </button>

        {aba !== 'problemas' && (
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
        {aba === 'problemas' && (
          <div id="painel-inferior-problemas" role="tabpanel" aria-labelledby="aba-inferior-problemas" className="h-full">
            <ListaProblemas problemas={problemas} aoEscolher={aoEscolherProblema} />
          </div>
        )}
        {aba === 'mensagens' && (
          <div id="painel-inferior-mensagens" role="tabpanel" aria-labelledby="aba-inferior-mensagens" className="h-full">
            <ListaMensagens entradas={mensagens} />
          </div>
        )}
        {aba === 'console' && (
          <div id="painel-inferior-console" role="tabpanel" aria-labelledby="aba-inferior-console" className="h-full">
            <Console entradas={entradasConsole} />
          </div>
        )}
      </div>
    </div>
  )
}
