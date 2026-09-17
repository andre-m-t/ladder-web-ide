/**
 * Lista de eventos do cliente (spec 002, plano D-13): compilação, gravação e
 * saúde do servidor. `lib/console.ts` monta cada entrada; este componente só
 * lista, colore por nível e rola para o fim sozinho a cada entrada nova. Sem
 * streaming da saída do `iec2c`/`idf.py` — o servidor continua síncrono
 * (spec 001, Q-6); isto é só o que o cliente já observa.
 */
import { useEffect, useRef } from 'react'

import type { EntradaConsole } from '../../lib/console'

export interface ConsoleProps {
  entradas: EntradaConsole[]
  aoLimpar: () => void
}

const ROTULO_NIVEL: Record<EntradaConsole['nivel'], string> = {
  info: 'INFO',
  sucesso: 'SUCESSO',
  aviso: 'AVISO',
  erro: 'ERRO',
}

const COR_NIVEL: Record<EntradaConsole['nivel'], string> = {
  info: 'text-ide-suave',
  sucesso: 'text-ide-sucesso',
  aviso: 'text-ide-aviso',
  erro: 'text-ide-perigo',
}

export default function Console({ entradas, aoLimpar }: ConsoleProps) {
  const listaRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const lista = listaRef.current
    if (lista) lista.scrollTop = lista.scrollHeight
  }, [entradas.length])

  return (
    <div className="flex h-full flex-col bg-ide-painel">
      <div className="flex shrink-0 items-center justify-between border-b border-ide-borda px-3 py-1.5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-ide-suave">Console</h2>
        <button
          type="button"
          onClick={aoLimpar}
          className="rounded px-2 py-0.5 text-xs text-ide-suave hover:bg-ide-elevado hover:text-ide-texto"
        >
          Limpar
        </button>
      </div>
      <div
        ref={listaRef}
        role="log"
        aria-live="polite"
        className="flex-1 overflow-y-auto px-3 py-1.5 font-mono text-xs leading-relaxed"
      >
        {entradas.map((entrada) => (
          <p key={entrada.id} className={COR_NIVEL[entrada.nivel]}>
            [{entrada.hora}] {ROTULO_NIVEL[entrada.nivel]}: {entrada.mensagem}
          </p>
        ))}
      </div>
    </div>
  )
}
