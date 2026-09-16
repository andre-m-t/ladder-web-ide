/**
 * Painel de variáveis (plano D-9): declara variável interna ou localizada
 * (endereço restrito aos quatro de `ladder/enderecos.ts`) e vincula a
 * variável ao elemento selecionado na grade.
 *
 * Controlado pelas props — o único estado próprio é o do formulário de
 * declaração, que não faz parte do diagrama. Não valida nome nem duplicata:
 * quem recusa é `edicao.ts`, e o motivo chega por `erro` (padrão de
 * `PainelErro.tsx`, `role="alert"`).
 */
import { useState, type FormEvent } from 'react'

import { ENDERECOS_LOCALIZADOS } from '../../ladder/enderecos'
import type { Elemento, Variavel } from '../../ladder/modelo'

export interface PainelVariaveisProps {
  variaveis: Variavel[]
  elementoSelecionado: Elemento | null
  aoDeclarar: (v: { nome: string; endereco?: string }) => void
  aoVincular: (elementoId: string, nome: string | null) => void
  erro?: string | null
}

type OrigemVariavel = 'interna' | 'localizada'

const OPCAO_SEM_VARIAVEL = ''

export default function PainelVariaveis({ variaveis, elementoSelecionado, aoDeclarar, aoVincular, erro }: PainelVariaveisProps) {
  const [nome, setNome] = useState('')
  const [origem, setOrigem] = useState<OrigemVariavel>('interna')
  const [endereco, setEndereco] = useState<string>(ENDERECOS_LOCALIZADOS[0] ?? '')

  function aoSubmeterDeclaracao(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (!nome) return
    if (origem === 'localizada') {
      aoDeclarar({ nome, endereco })
    } else {
      aoDeclarar({ nome })
    }
    setNome('')
  }

  return (
    <section aria-label="Variáveis" className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-700">Variáveis</h2>

      {erro && (
        <p role="alert" className="mt-2 rounded border border-red-200 bg-red-50 p-2 text-sm text-red-900">
          {erro}
        </p>
      )}

      <form onSubmit={aoSubmeterDeclaracao} className="mt-3 flex flex-col gap-2">
        <div>
          <label htmlFor="painel-variaveis-nome" className="block text-xs font-medium text-slate-600">
            Nome
          </label>
          <input
            id="painel-variaveis-nome"
            type="text"
            value={nome}
            onChange={(evento) => setNome(evento.target.value)}
            className="mt-1 block w-full rounded border border-slate-300 p-1 text-sm"
          />
        </div>

        <fieldset className="flex flex-col gap-1">
          <legend className="text-xs font-medium text-slate-600">Origem</legend>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="radio"
              name="origem-variavel"
              value="interna"
              checked={origem === 'interna'}
              onChange={() => setOrigem('interna')}
            />
            interna
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="radio"
              name="origem-variavel"
              value="localizada"
              checked={origem === 'localizada'}
              onChange={() => setOrigem('localizada')}
            />
            endereço localizado
          </label>
        </fieldset>

        {origem === 'localizada' && (
          <div>
            <label htmlFor="painel-variaveis-endereco" className="block text-xs font-medium text-slate-600">
              Endereço
            </label>
            <select
              id="painel-variaveis-endereco"
              value={endereco}
              onChange={(evento) => setEndereco(evento.target.value)}
              className="mt-1 block rounded border border-slate-300 p-1 text-sm"
            >
              {ENDERECOS_LOCALIZADOS.map((umEndereco) => (
                <option key={umEndereco} value={umEndereco}>
                  {umEndereco}
                </option>
              ))}
            </select>
          </div>
        )}

        <button
          type="submit"
          className="self-start rounded bg-slate-900 px-3 py-1 text-sm font-medium text-white hover:bg-slate-700"
        >
          Declarar
        </button>
      </form>

      <ul className="mt-4 flex flex-col gap-1 text-sm text-slate-700">
        {variaveis.map((variavel) => (
          <li key={variavel.nome}>
            <span className="font-mono">{variavel.nome}</span>{' '}
            <span className="text-slate-500">({variavel.endereco ?? 'interna'})</span>
          </li>
        ))}
      </ul>

      {elementoSelecionado && (
        <div className="mt-4">
          <label htmlFor="painel-variaveis-vincular" className="block text-xs font-medium text-slate-600">
            Vincular variável ao elemento selecionado
          </label>
          <select
            id="painel-variaveis-vincular"
            value={elementoSelecionado.variavel ?? OPCAO_SEM_VARIAVEL}
            onChange={(evento) =>
              aoVincular(elementoSelecionado.id, evento.target.value === OPCAO_SEM_VARIAVEL ? null : evento.target.value)
            }
            className="mt-1 block rounded border border-slate-300 p-1 text-sm"
          >
            <option value={OPCAO_SEM_VARIAVEL}>sem variável</option>
            {variaveis.map((variavel) => (
              <option key={variavel.nome} value={variavel.nome}>
                {variavel.nome}
              </option>
            ))}
          </select>
        </div>
      )}
    </section>
  )
}
