/**
 * Tabela de variáveis do editor (plano D-12, tarefa #22, frente D1).
 *
 * Substitui `PainelVariaveis.tsx` (apagado pela frente D2): não há mais
 * vínculo elemento↔variável por aqui — isso passou para o duplo clique/Enter
 * no item da grade, que abre `ModalVariavel`. Esta tabela só declara, edita e
 * remove variáveis. Controlada pelas props — nenhum estado do diagrama mora
 * aqui; o único estado próprio é o dos campos em edição de cada linha (nome
 * digitado, mensagem local de "sem endereço livre"), que não faz parte do
 * diagrama.
 *
 * "Tipo" (entrada/saída/interna) é a classe da variável (`enderecos.ts`),
 * derivada do endereço — o tipo de dado continua único (`BOOL`, Q-5/D-2).
 * "Valor" é o endereço: para entrada/saída, um dos endereços livres da classe
 * (mais o da própria linha); para interna, não se aplica.
 *
 * Toda mudança passa por `aoDeclarar`/`aoAtualizar`/`aoRemover`, fornecidas
 * pelo editor, que por sua vez chamam o núcleo (`edicao.ts`) — quem recusa é
 * o núcleo, e o motivo chega por `erro` (padrão de `PainelVariaveis.tsx`,
 * `role="alert"`). Endereço indisponível ao trocar de tipo é checado aqui
 * mesmo (não há operação de núcleo só para "existe endereço livre?"), e por
 * isso aparece como mensagem local, não em `erro`.
 */
import { useState, type ChangeEvent, type KeyboardEvent } from 'react'

import { classeDaVariavel, enderecosDaClasse, type ClasseVariavel } from '../../ladder/enderecos'
import type { Variavel } from '../../ladder/modelo'

export interface TabelaVariaveisProps {
  variaveis: Variavel[]
  aoDeclarar: (v: { nome: string; endereco?: string }) => void
  aoAtualizar: (nomeAtual: string, v: { nome: string; endereco?: string }) => void
  aoRemover: (nome: string) => void
  erro?: string | null
}

const CLASSES: ClasseVariavel[] = ['entrada', 'saida', 'interna']

const ROTULO_CLASSE: Record<ClasseVariavel, string> = {
  entrada: 'Entrada',
  saida: 'Saída',
  interna: 'Interna',
}

/** Endereços da classe ainda livres (não usados por outra variável que não
 * `ignorarNome`) — inclui o endereço da própria linha, porque ela não conta
 * como "outra variável". Interna não tem endereço: sempre `[]`. */
function enderecosLivres(variaveis: Variavel[], classe: ClasseVariavel, ignorarNome?: string): string[] {
  if (classe === 'interna') return []
  const usadosPorOutra = new Set(
    variaveis.filter((v) => v.nome !== ignorarNome && v.endereco !== undefined).map((v) => v.endereco as string),
  )
  return enderecosDaClasse(classe).filter((endereco) => !usadosPorOutra.has(endereco))
}

function mensagemSemEndereco(classe: ClasseVariavel): string {
  return `sem endereço de ${ROTULO_CLASSE[classe].toLowerCase()} livre`
}

interface LinhaVariavelProps {
  variavel: Variavel
  variaveis: Variavel[]
  aoAtualizar: TabelaVariaveisProps['aoAtualizar']
  aoRemover: TabelaVariaveisProps['aoRemover']
}

function LinhaVariavel({ variavel, variaveis, aoAtualizar, aoRemover }: LinhaVariavelProps) {
  const [nome, setNome] = useState(variavel.nome)
  const [mensagem, setMensagem] = useState<string | null>(null)

  const classe = classeDaVariavel(variavel)
  const livres = enderecosLivres(variaveis, classe, variavel.nome)
  const opcoesValor =
    variavel.endereco !== undefined && !livres.includes(variavel.endereco) ? [variavel.endereco, ...livres] : livres

  function confirmarNome() {
    const novoNome = nome.trim()
    if (novoNome.length === 0 || novoNome === variavel.nome) {
      setNome(variavel.nome)
      return
    }
    aoAtualizar(variavel.nome, { nome: novoNome, endereco: variavel.endereco })
  }

  function aoTeclarNome(evento: KeyboardEvent<HTMLInputElement>) {
    if (evento.key === 'Enter') {
      evento.currentTarget.blur()
    }
  }

  function aoMudarTipo(evento: ChangeEvent<HTMLSelectElement>) {
    const novaClasse = evento.target.value as ClasseVariavel
    if (novaClasse === classe) return

    if (novaClasse === 'interna') {
      setMensagem(null)
      aoAtualizar(variavel.nome, { nome: variavel.nome })
      return
    }

    const livresNaNovaClasse = enderecosLivres(variaveis, novaClasse, variavel.nome)
    if (livresNaNovaClasse.length === 0) {
      setMensagem(mensagemSemEndereco(novaClasse))
      return
    }
    setMensagem(null)
    aoAtualizar(variavel.nome, { nome: variavel.nome, endereco: livresNaNovaClasse[0] })
  }

  function aoMudarValor(evento: ChangeEvent<HTMLSelectElement>) {
    aoAtualizar(variavel.nome, { nome: variavel.nome, endereco: evento.target.value })
  }

  return (
    <tr>
      <td className="py-1 pr-1">
        <input
          type="text"
          aria-label={`Nome da variável ${variavel.nome}`}
          value={nome}
          onChange={(evento) => setNome(evento.target.value)}
          onBlur={confirmarNome}
          onKeyDown={aoTeclarNome}
          className="w-full min-w-0 rounded border border-slate-300 p-1 text-sm"
        />
      </td>
      <td className="py-1 pr-1 align-top">
        <select
          aria-label={`Tipo de ${variavel.nome}`}
          value={classe}
          onChange={aoMudarTipo}
          className="w-full min-w-0 rounded border border-slate-300 p-1 text-xs"
        >
          {CLASSES.map((c) => (
            <option key={c} value={c}>
              {ROTULO_CLASSE[c]}
            </option>
          ))}
        </select>
        {mensagem && <p className="mt-0.5 text-xs text-red-700">{mensagem}</p>}
      </td>
      <td className="py-1 pr-1">
        {classe === 'interna' ? (
          <select
            aria-label={`Valor de ${variavel.nome}`}
            value="—"
            disabled
            className="w-full min-w-0 rounded border border-slate-200 p-1 text-xs text-slate-400"
          >
            <option value="—">—</option>
          </select>
        ) : (
          <select
            aria-label={`Valor de ${variavel.nome}`}
            value={variavel.endereco}
            onChange={aoMudarValor}
            className="w-full min-w-0 rounded border border-slate-300 p-1 text-xs"
          >
            {opcoesValor.map((endereco) => (
              <option key={endereco} value={endereco}>
                {endereco}
              </option>
            ))}
          </select>
        )}
      </td>
      <td className="py-1 pl-1 text-right">
        <button
          type="button"
          aria-label={`Remover variável ${variavel.nome}`}
          onClick={() => aoRemover(variavel.nome)}
          className="rounded px-1 text-sm text-red-700 hover:bg-red-50"
        >
          ✕
        </button>
      </td>
    </tr>
  )
}

interface LinhaNovaVariavelProps {
  variaveis: Variavel[]
  aoDeclarar: TabelaVariaveisProps['aoDeclarar']
}

function LinhaNovaVariavel({ variaveis, aoDeclarar }: LinhaNovaVariavelProps) {
  const [nome, setNome] = useState('')
  const [classe, setClasse] = useState<ClasseVariavel>('interna')
  const [endereco, setEndereco] = useState<string | undefined>(undefined)
  const [mensagem, setMensagem] = useState<string | null>(null)

  const livres = enderecosLivres(variaveis, classe)

  function aoMudarTipo(evento: ChangeEvent<HTMLSelectElement>) {
    const novaClasse = evento.target.value as ClasseVariavel
    setClasse(novaClasse)

    if (novaClasse === 'interna') {
      setEndereco(undefined)
      setMensagem(null)
      return
    }

    const livresNaNovaClasse = enderecosLivres(variaveis, novaClasse)
    if (livresNaNovaClasse.length === 0) {
      setEndereco(undefined)
      setMensagem(mensagemSemEndereco(novaClasse))
    } else {
      setEndereco(livresNaNovaClasse[0])
      setMensagem(null)
    }
  }

  function aoAdicionar() {
    const nomeLimpo = nome.trim()
    if (nomeLimpo.length === 0) return

    if (classe === 'interna') {
      aoDeclarar({ nome: nomeLimpo })
    } else {
      if (endereco === undefined) return
      aoDeclarar({ nome: nomeLimpo, endereco })
    }
    setNome('')
  }

  return (
    <tr>
      <td className="py-1 pr-1">
        <input
          type="text"
          aria-label="Nome da nova variável"
          value={nome}
          onChange={(evento) => setNome(evento.target.value)}
          className="w-full min-w-0 rounded border border-slate-300 p-1 text-sm"
        />
      </td>
      <td className="py-1 pr-1 align-top">
        <select
          aria-label="Tipo da nova variável"
          value={classe}
          onChange={aoMudarTipo}
          className="w-full min-w-0 rounded border border-slate-300 p-1 text-xs"
        >
          {CLASSES.map((c) => (
            <option key={c} value={c}>
              {ROTULO_CLASSE[c]}
            </option>
          ))}
        </select>
        {mensagem && <p className="mt-0.5 text-xs text-red-700">{mensagem}</p>}
      </td>
      <td className="py-1 pr-1">
        {classe === 'interna' ? (
          <select
            aria-label="Valor da nova variável"
            value="—"
            disabled
            className="w-full min-w-0 rounded border border-slate-200 p-1 text-xs text-slate-400"
          >
            <option value="—">—</option>
          </select>
        ) : (
          <select
            aria-label="Valor da nova variável"
            value={endereco ?? ''}
            onChange={(evento) => setEndereco(evento.target.value)}
            className="w-full min-w-0 rounded border border-slate-300 p-1 text-xs"
          >
            {livres.map((umEndereco) => (
              <option key={umEndereco} value={umEndereco}>
                {umEndereco}
              </option>
            ))}
          </select>
        )}
      </td>
      <td className="py-1 pl-1 text-right">
        <button
          type="button"
          onClick={aoAdicionar}
          className="whitespace-nowrap rounded bg-slate-900 px-1.5 py-1 text-[11px] font-medium text-white hover:bg-slate-700"
        >
          Adicionar
        </button>
      </td>
    </tr>
  )
}

export default function TabelaVariaveis({ variaveis, aoDeclarar, aoAtualizar, aoRemover, erro }: TabelaVariaveisProps) {
  return (
    <section aria-label="Variáveis" className="w-full rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-700">Variáveis</h2>

      {/* table-fixed + colgroup: sem isso, cada `<select>` reivindica a
          largura da sua opção mais longa e a coluna Nome fica espremida
          (visto em Chromium real a 1280px — nome de 7 letras cortado). */}
      <table className="mt-3 w-full table-fixed border-collapse text-sm">
        <colgroup>
          <col className="w-[32%]" />
          <col className="w-[26%]" />
          <col className="w-[24%]" />
          <col className="w-[18%]" />
        </colgroup>
        <thead>
          <tr className="text-left text-xs font-medium text-slate-500">
            <th scope="col" className="pb-1 pr-1 font-medium">
              Nome
            </th>
            <th scope="col" className="pb-1 pr-1 font-medium">
              Tipo
            </th>
            <th scope="col" className="pb-1 pr-1 font-medium">
              Valor
            </th>
            <th scope="col" className="pb-1 font-medium">
              <span className="sr-only">Ação</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {variaveis.map((variavel) => (
            <LinhaVariavel key={variavel.nome} variavel={variavel} variaveis={variaveis} aoAtualizar={aoAtualizar} aoRemover={aoRemover} />
          ))}
          <LinhaNovaVariavel variaveis={variaveis} aoDeclarar={aoDeclarar} />
        </tbody>
      </table>

      {erro && (
        <p role="alert" className="mt-2 rounded border border-red-200 bg-red-50 p-2 text-sm text-red-900">
          {erro}
        </p>
      )}
    </section>
  )
}
