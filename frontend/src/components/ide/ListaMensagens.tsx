/**
 * Lista de mensagens do painel inferior (spec 002, tarefa #26): mesma
 * origem de dados do Console (`EntradaConsole`), mas mostrada de outro jeito
 * — hora, um ícone por nível (em vez do rótulo textual "INFO:"/"ERRO:") e o
 * texto, em fonte monoespaçada. É a aba "Mensagens" ao lado de "Problemas" e
 * "Console" em `PainelInferiorConteudo`.
 *
 * `role="log"` tem nome próprio ("Mensagens"), distinto do `role="log"` do
 * Console, para as duas regiões não se confundirem em leitores de tela nem
 * em consultas de teste por nome acessível.
 *
 * A contagem de não lidas e a limpeza são decididas por quem chama este
 * componente (`App`/`PainelInferiorConteudo`) — aqui só a lista e o estado
 * vazio.
 */
import { CheckCircle2, CircleX, Info, TriangleAlert } from 'lucide-react'
import { useEffect, useRef } from 'react'

import type { EntradaConsole } from '../../lib/console'

export interface ListaMensagensProps {
  entradas: EntradaConsole[]
}

const ICONE_NIVEL: Record<EntradaConsole['nivel'], typeof Info> = {
  info: Info,
  sucesso: CheckCircle2,
  aviso: TriangleAlert,
  erro: CircleX,
}

const COR_NIVEL: Record<EntradaConsole['nivel'], string> = {
  info: 'text-ide-suave',
  sucesso: 'text-ide-sucesso',
  aviso: 'text-ide-aviso',
  erro: 'text-ide-perigo',
}

export default function ListaMensagens({ entradas }: ListaMensagensProps) {
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
      aria-label="Mensagens"
      className="h-full overflow-y-auto bg-ide-painel px-3 py-1.5 font-mono text-xs leading-relaxed"
    >
      {entradas.length === 0 ? (
        <div className="flex h-full items-center justify-center text-ide-suave">Nenhuma mensagem.</div>
      ) : (
        entradas.map((entrada) => {
          const Icone = ICONE_NIVEL[entrada.nivel]
          return (
            <p key={entrada.id} className="flex items-start gap-1.5">
              <span className="shrink-0 text-ide-suave">[{entrada.hora}]</span>
              <Icone aria-hidden="true" size={14} className={`mt-0.5 shrink-0 ${COR_NIVEL[entrada.nivel]}`} />
              <span className={COR_NIVEL[entrada.nivel]}>{entrada.mensagem}</span>
            </p>
          )
        })
      )}
    </div>
  )
}
