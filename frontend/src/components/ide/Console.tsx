/**
 * Console de eventos do cliente (spec 002, plano D-13; revisado na tarefa
 * #26): histórico de compilação, gravação e saúde do servidor. `lib/console.ts`
 * monta cada entrada; este componente só lista, colore por nível e rola para
 * o fim sozinho a cada entrada nova. Sem streaming da saída do
 * `iec2c`/`idf.py` — o servidor continua síncrono (spec 001, Q-6); isto é só
 * o que o cliente já observa.
 *
 * Deixou de ter cabeçalho e botão "Limpar" próprios (tarefa #26): as abas do
 * painel inferior (Problemas/Console, desde a tarefa #27 — Mensagens e "ST
 * gerado" saíram, ver `PainelInferiorConteudo`) passaram a compartilhar uma
 * única lixeira "Limpar" na faixa de abas (`PainelInferiorConteudo`), que
 * decide qual conteúdo limpar conforme a aba ativa — este componente virou
 * puramente a lista, com estado vazio próprio.
 */
import { useEffect, useRef } from 'react'

import type { EntradaConsole } from '../../lib/console'

export interface ConsoleProps {
  entradas: EntradaConsole[]
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

export default function Console({ entradas }: ConsoleProps) {
  const listaRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const lista = listaRef.current
    if (lista) lista.scrollTop = lista.scrollHeight
  }, [entradas.length])

  return (
    <div
      ref={listaRef}
      role="log"
      aria-live="polite"
      aria-label="Console"
      className="h-full overflow-y-auto bg-ide-painel px-3 py-1.5 font-mono text-xs leading-relaxed"
    >
      {entradas.length === 0 ? (
        <div className="flex h-full items-center justify-center text-ide-suave">Nenhum registro.</div>
      ) : (
        entradas.map((entrada) => (
          <p key={entrada.id} className={COR_NIVEL[entrada.nivel]}>
            [{entrada.hora}] {ROTULO_NIVEL[entrada.nivel]}: {entrada.mensagem}
          </p>
        ))
      )}
    </div>
  )
}
