/**
 * Painel do ambiente de simulação (spec 005) — conteúdo do painel lateral
 * direito, não janela flutuante.
 *
 * **Contrato de E/S (revisão 2026-09-23):** aberto por padrão, mostra por
 * ponto o nome da variável vinculada ao endereço ou, sem vínculo, o botão
 * "Criar" — abre `ModalNovaVariavel` com o endereço fixo e o nome sugerido
 * pelo contrato. "Criar todas" declara de uma vez as que faltam. Com o
 * ambiente ocupando o slot das variáveis, é aqui que o programa é montado
 * pensando na planta, sem alternar de painel. Quem aplica é `App`
 * (`aoDeclararVariavel`/`aoDeclararTodas`), pelo mesmo `declararVariavel` da
 * tabela e com uma entrada no histórico de Desfazer; durante a simulação a criação fica
 * desabilitada com o motivo (`motivoCriacaoIndisponivel`).
 */
import { useState } from 'react'

import { Plus, X } from 'lucide-react'

import type { Diagrama } from '../../ladder/modelo'
import { CATALOGO_AMBIENTES, AMBIENTE_PADRAO_ID } from '../../ambientes/catalogo'
import type { PontoAmbiente } from '../../ambientes/contrato'
import type { EstadoPortao } from '../../ambientes/portao'
import { nomeVariavelPorEndereco, pontosSemVariavel, sugerirNomeVariavel } from '../../ambientes/vinculo'
import ModalNovaVariavel from '../ladder/ModalNovaVariavel'
import CenaPortao from './CenaPortao'

export interface PainelAmbienteProps {
  aoFechar: () => void
  ambienteId: string
  diagrama: Diagrama | null
  estadoPlanta: EstadoPortao
  saidasPorEndereco: Record<string, boolean>
  simulacaoAtiva: boolean
  aoComando: (comando: string, pressionado: boolean) => void
  /** Declara a variável de um ponto; devolve o motivo da recusa (mostrado no
   * modal) ou `null` no sucesso. Ausente, o contrato só mostra os vínculos. */
  aoDeclararVariavel?: (ponto: PontoAmbiente, nome: string) => string | null
  /** Declara todas as que faltam — a recusa, se houver, é de quem monta. */
  aoDeclararTodas?: () => void
  /** Presente quando criar variável não é permitido agora (simulação ativa). */
  motivoCriacaoIndisponivel?: string
}

export default function PainelAmbiente({
  aoFechar,
  ambienteId,
  diagrama,
  estadoPlanta,
  saidasPorEndereco,
  simulacaoAtiva,
  aoComando,
  aoDeclararVariavel,
  aoDeclararTodas,
  motivoCriacaoIndisponivel,
}: PainelAmbienteProps) {
  const def = CATALOGO_AMBIENTES.find((a) => a.id === ambienteId) ?? CATALOGO_AMBIENTES[0]
  const titulo = `Ambiente — ${def.nome}`
  const [pontoCriando, setPontoCriando] = useState<PontoAmbiente | null>(null)

  const faltando = diagrama ? pontosSemVariavel(diagrama, def.pontos) : []
  const conectados = def.pontos.length - faltando.length
  const podeCriar = diagrama !== null && aoDeclararVariavel !== undefined
  const criacaoBloqueada = motivoCriacaoIndisponivel !== undefined

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex shrink-0 items-center justify-between border-b border-ide-borda bg-ide-elevado px-3 py-2">
        <h2 className="text-sm font-semibold text-ide-texto">{titulo}</h2>
        <button
          type="button"
          className="rounded p-1 text-ide-suave hover:bg-ide-fundo hover:text-ide-texto"
          aria-label="Fechar ambiente"
          onClick={aoFechar}
        >
          <X size={16} aria-hidden />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-auto p-3">
        {ambienteId === AMBIENTE_PADRAO_ID && (
          <CenaPortao
            estado={estadoPlanta}
            saidas={saidasPorEndereco}
            simulacaoAtiva={simulacaoAtiva}
            aoComando={(c, p) => aoComando(c, p)}
          />
        )}

        <details open className="mt-4 text-xs">
          <summary className="cursor-pointer text-ide-texto">
            Contrato de E/S{' '}
            {diagrama && (
              <span className="text-ide-suave">
                · {conectados} de {def.pontos.length} conectados
              </span>
            )}
          </summary>

          {podeCriar && faltando.length > 0 && (
            <div className="mt-2 flex items-center justify-between gap-2">
              <p className="text-ide-suave">Pontos sem variável não chegam ao programa.</p>
              {aoDeclararTodas && (
                <button
                  type="button"
                  onClick={aoDeclararTodas}
                  disabled={criacaoBloqueada}
                  title={motivoCriacaoIndisponivel ?? 'Declara uma variável para cada ponto não conectado, com o nome sugerido'}
                  className="inline-flex shrink-0 items-center gap-1 rounded border border-ide-borda px-2 py-1 font-medium text-ide-texto hover:bg-ide-elevado disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Plus aria-hidden size={12} />
                  Criar todas ({faltando.length})
                </button>
              )}
            </div>
          )}

          <table className="mt-2 w-full border-collapse">
            <thead>
              <tr className="text-left text-ide-suave">
                <th className="py-1 pr-2">Ponto</th>
                <th className="py-1 pr-2">Endereço</th>
                <th className="py-1">Variável</th>
              </tr>
            </thead>
            <tbody>
              {def.pontos.map((p) => {
                const nome = diagrama ? nomeVariavelPorEndereco(diagrama, p.endereco) : null
                return (
                  <tr key={p.endereco} className="border-t border-ide-borda/50">
                    <td className="py-1 pr-2">{p.rotulo}</td>
                    <td className="py-1 pr-2 font-mono">{p.endereco}</td>
                    <td className="py-1">
                      {nome !== null ? (
                        <span className="font-mono text-ide-texto">{nome}</span>
                      ) : podeCriar ? (
                        <button
                          type="button"
                          onClick={() => setPontoCriando(p)}
                          disabled={criacaoBloqueada}
                          aria-label={`Criar variável para ${p.rotulo} (${p.endereco})`}
                          title={motivoCriacaoIndisponivel ?? 'Criar a variável deste ponto'}
                          className="inline-flex items-center gap-1 rounded border border-dashed border-ide-borda px-1.5 py-0.5 text-ide-destaque hover:bg-ide-elevado disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Plus aria-hidden size={11} />
                          Criar
                        </button>
                      ) : (
                        <span className="text-ide-suave">{diagrama ? '— não conectado' : '—'}</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </details>
      </div>

      {pontoCriando && diagrama && aoDeclararVariavel && (
        <ModalNovaVariavel
          variaveis={diagrama.variaveis}
          enderecoFixo={pontoCriando.endereco}
          sugerirNome={() => sugerirNomeVariavel(pontoCriando, diagrama.variaveis)}
          contexto={`Ponto «${pontoCriando.rotulo}» do ambiente ${def.nome}`}
          aoCriar={({ nome }) => {
            const motivo = aoDeclararVariavel(pontoCriando, nome)
            if (motivo === null) setPontoCriando(null)
            return motivo
          }}
          aoCancelar={() => setPontoCriando(null)}
        />
      )}
    </div>
  )
}
