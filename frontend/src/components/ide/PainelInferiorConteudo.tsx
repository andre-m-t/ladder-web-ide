/**
 * Conteúdo do painel inferior da IDE (spec 002, tarefa #13, plano D-13):
 * abas "Problemas (N)" e "Console", no padrão ARIA de tablist (`role="tablist"`
 * / `tab` / `tabpanel`, `aria-selected`, navegação por setas). O botão de
 * recolher da `BarraSuperior` continua agindo sobre o `PainelInferior`
 * inteiro (`App.tsx`) — recolher esconde as duas abas juntas, não só o
 * console.
 *
 * A aba ativa é decidida pelo `App` (preferência em `localStorage`, mesmo
 * padrão das outras preferências de layout) — este componente só recebe
 * `aba`/`aoMudarAba` e não guarda estado próprio, para caber no mesmo estilo
 * controlado do resto da IDE.
 */
import { useRef, type KeyboardEvent } from 'react'
import { SquareTerminal, TriangleAlert } from 'lucide-react'

import type { EntradaConsole } from '../../lib/console'
import type { Problema } from '../../ladder/validacao'
import Console from './Console'
import ListaProblemas from './ListaProblemas'

export type AbaInferior = 'problemas' | 'console'

export interface PainelInferiorConteudoProps {
  aba: AbaInferior
  aoMudarAba: (aba: AbaInferior) => void
  problemas: Problema[]
  aoEscolherProblema: (problema: Problema) => void
  entradasConsole: EntradaConsole[]
  aoLimparConsole: () => void
}

export default function PainelInferiorConteudo({
  aba,
  aoMudarAba,
  problemas,
  aoEscolherProblema,
  entradasConsole,
  aoLimparConsole,
}: PainelInferiorConteudoProps) {
  const refProblemas = useRef<HTMLButtonElement | null>(null)
  const refConsole = useRef<HTMLButtonElement | null>(null)

  const erros = problemas.filter((problema) => problema.severidade === 'erro')

  /** Navegação por setas do tablist (WAI-ARIA Authoring Practices): ←/→
   * movem foco e seleção entre as duas abas, com volta ao início/fim. */
  function aoTeclarNaAba(evento: KeyboardEvent<HTMLButtonElement>) {
    if (evento.key !== 'ArrowLeft' && evento.key !== 'ArrowRight') return
    evento.preventDefault()
    const proxima: AbaInferior = aba === 'problemas' ? 'console' : 'problemas'
    aoMudarAba(proxima)
    ;(proxima === 'problemas' ? refProblemas : refConsole).current?.focus()
  }

  return (
    <div className="flex h-full flex-col bg-ide-painel">
      <div role="tablist" aria-label="Painel inferior" className="flex shrink-0 items-center gap-1 border-b border-ide-borda px-2 py-1">
        <button
          ref={refProblemas}
          type="button"
          role="tab"
          id="aba-problemas"
          aria-selected={aba === 'problemas'}
          aria-controls="painel-problemas"
          tabIndex={aba === 'problemas' ? 0 : -1}
          onClick={() => aoMudarAba('problemas')}
          onKeyDown={aoTeclarNaAba}
          className={
            aba === 'problemas'
              ? 'flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium text-ide-texto'
              : 'flex items-center gap-1.5 rounded px-2.5 py-1 text-xs text-ide-suave hover:text-ide-texto'
          }
        >
          {erros.length > 0 && <TriangleAlert aria-hidden="true" size={14} className="text-ide-perigo" />}
          Problemas ({problemas.length})
        </button>
        <button
          ref={refConsole}
          type="button"
          role="tab"
          id="aba-console"
          aria-selected={aba === 'console'}
          aria-controls="painel-console"
          tabIndex={aba === 'console' ? 0 : -1}
          onClick={() => aoMudarAba('console')}
          onKeyDown={aoTeclarNaAba}
          className={
            aba === 'console'
              ? 'flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium text-ide-texto'
              : 'flex items-center gap-1.5 rounded px-2.5 py-1 text-xs text-ide-suave hover:text-ide-texto'
          }
        >
          <SquareTerminal aria-hidden="true" size={14} />
          Console
        </button>
      </div>

      <div className="min-h-0 flex-1">
        {aba === 'problemas' ? (
          <div id="painel-problemas" role="tabpanel" aria-labelledby="aba-problemas" className="h-full">
            <ListaProblemas problemas={problemas} aoEscolher={aoEscolherProblema} />
          </div>
        ) : (
          <div id="painel-console" role="tabpanel" aria-labelledby="aba-console" className="h-full">
            <Console entradas={entradasConsole} aoLimpar={aoLimparConsole} />
          </div>
        )}
      </div>
    </div>
  )
}
