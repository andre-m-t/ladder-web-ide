/**
 * Lista de problemas do diagrama (spec 002, tarefa #13, plano D-13):
 * `validarDiagrama` roda no `App` a cada mudança do diagrama (`useMemo`) e o
 * resultado chega aqui só para exibição — este componente não valida nada
 * sozinho.
 *
 * Erros e avisos aparecem em grupos separados (Q-6: severidade distingue os
 * dois). O grupo de erros usa `role="alert"` — só quando há pelo menos um
 * erro, para não anunciar uma região vazia a cada render. Cada problema é um
 * botão: clicar nele é o gesto que o `App` usa para levar o foco até a célula
 * (troca de aba Ladder/ST + `foco` passado ao `EditorLadder`, tarefa #13,
 * item 4) — este componente só relata a escolha por `aoEscolher`, sem saber
 * nada sobre abas ou foco.
 */
import { CircleX, TriangleAlert } from 'lucide-react'

import type { Problema } from '../../ladder/validacao'

export interface ListaProblemasProps {
  problemas: Problema[]
  aoEscolher: (problema: Problema) => void
}

/** Chave estável para a lista — `Problema` não tem `id` próprio, então a
 * combinação de código, degrau, elemento e índice (para o raro caso de duas
 * mensagens idênticas) já é suficiente. */
function chaveProblema(problema: Problema, indice: number): string {
  return `${problema.codigo}:${problema.rungId}:${problema.elementoId ?? '-'}:${indice}`
}

function GrupoProblemas({
  titulo,
  Icone,
  corTexto,
  problemas,
  aoEscolher,
  comoAlerta,
}: {
  titulo: string
  Icone: typeof CircleX
  corTexto: string
  problemas: Problema[]
  aoEscolher: (problema: Problema) => void
  comoAlerta: boolean
}) {
  if (problemas.length === 0) return null

  return (
    <div role={comoAlerta ? 'alert' : undefined}>
      <h3 className={`mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide ${corTexto}`}>
        <Icone aria-hidden="true" size={14} />
        {titulo} ({problemas.length})
      </h3>
      <ul className="flex flex-col gap-0.5">
        {problemas.map((problema, indice) => (
          <li key={chaveProblema(problema, indice)}>
            <button
              type="button"
              onClick={() => aoEscolher(problema)}
              className="flex w-full items-start gap-2 rounded px-2 py-1 text-left text-ide-texto hover:bg-ide-elevado"
            >
              <Icone aria-hidden="true" size={16} className={`mt-0.5 shrink-0 ${corTexto}`} />
              <span>
                <span className={`font-medium ${corTexto}`}>{problema.severidade === 'erro' ? 'Erro: ' : 'Aviso: '}</span>
                {problema.mensagem}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function ListaProblemas({ problemas, aoEscolher }: ListaProblemasProps) {
  const erros = problemas.filter((problema) => problema.severidade === 'erro')
  const avisos = problemas.filter((problema) => problema.severidade === 'aviso')

  if (problemas.length === 0) {
    return <div className="flex h-full items-center justify-center p-4 text-sm text-ide-suave">Nenhum problema.</div>
  }

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto p-3 text-sm">
      <GrupoProblemas titulo="Erros" Icone={CircleX} corTexto="text-ide-perigo" problemas={erros} aoEscolher={aoEscolher} comoAlerta />
      <GrupoProblemas titulo="Avisos" Icone={TriangleAlert} corTexto="text-ide-aviso" problemas={avisos} aoEscolher={aoEscolher} comoAlerta={false} />
    </div>
  )
}
