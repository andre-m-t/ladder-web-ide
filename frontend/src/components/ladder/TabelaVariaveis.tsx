/**
 * Painel de variáveis — conteúdo visual (spec 002, plano D-13, tarefa #23,
 * frente V).
 *
 * Redesenho sobre a tabela da tarefa #22: agora é o corpo inteiro do painel
 * lateral direito da IDE (cabeçalho com contador, abas de filtro por classe,
 * formulário "Adicionar variável", lista e rodapé com o mapa de pinos), não
 * mais só a tabela. Quem monta este componente na IDE e fala com o núcleo é
 * `PainelVariaveis.tsx`: este arquivo é puramente controlado pelas props,
 * sem tocar `edicao.ts` diretamente.
 *
 * "Tipo" não é mais uma escolha: todo dado é `BOOL` (Q-5/D-2), então a coluna
 * só exibe o texto fixo. A classe (entrada/saída/interna) continua derivada
 * do endereço (`enderecos.ts`) e só aparece aqui como filtro em abas — trocar
 * de classe é trocar de endereço, no próprio select da coluna Endereço.
 *
 * "Valor" é o estado ao vivo da variável — hoje sem fonte (chega com o
 * simulador, F9). A prop opcional `valores` já deixa a célula pronta: sem ela
 * (ou sem entrada para o nome), mostra "—" com dica acessível; com ela,
 * mostra o booleano em selo `TRUE`/`FALSE`.
 *
 * Só tokens de tema (`index.css`, `bg-ide-*`/`text-ide-*`/`border-ide-*`) —
 * nenhuma cor Tailwind fixa (`slate-*`, `sky-*`, `red-*`...).
 */
import { useRef, useState, type ChangeEvent, type FormEvent, type KeyboardEvent } from 'react'

import {
  ENTRADAS_LOCALIZADAS,
  GPIO_DO_ENDERECO,
  SAIDAS_LOCALIZADAS,
  classeDaVariavel,
  enderecosDaClasse,
  type ClasseVariavel,
} from '../../ladder/enderecos'
import type { Variavel } from '../../ladder/modelo'

export interface TabelaVariaveisProps {
  variaveis: Variavel[]
  /** Estado ao vivo por nome de variável (ainda sem fonte — estrutura para o simulador, F9). */
  valores?: Record<string, boolean>
  /** Recusa do núcleo a exibir (`role="alert"`), preenchida por `PainelVariaveis`. */
  erro?: string | null
  aoDeclarar: (v: { nome: string; endereco?: string }) => void
  aoAtualizar: (nomeAtual: string, v: { nome: string; endereco?: string }) => void
  aoRemover: (nome: string) => void
}

type ClasseFiltro = ClasseVariavel | 'todas'

const ABAS: ClasseFiltro[] = ['todas', 'entrada', 'saida', 'interna']

const ROTULO_ABA: Record<ClasseFiltro, string> = {
  todas: 'Todas',
  entrada: 'Entradas',
  saida: 'Saídas',
  interna: 'Internas',
}

/** Endereços de `classe` não usados por outra variável (ignora `ignorarNome`,
 * a própria linha sendo editada — o endereço dela continua "livre" aos olhos
 * dela mesma). */
function enderecosLivresClasse(variaveis: Variavel[], classe: 'entrada' | 'saida', ignorarNome?: string): string[] {
  const usadosPorOutra = new Set(
    variaveis.filter((v) => v.nome !== ignorarNome && v.endereco !== undefined).map((v) => v.endereco as string),
  )
  return enderecosDaClasse(classe).filter((endereco) => !usadosPorOutra.has(endereco))
}

/** Opções de um `<select>` de endereço: interna + livres agrupados por classe.
 * Usado tanto no formulário (sem `ignorarNome`) quanto na edição de uma linha
 * (ignorando a própria variável, cujo endereço deve continuar oferecido). */
function OpcoesEndereco({ variaveis, ignorarNome }: { variaveis: Variavel[]; ignorarNome?: string }) {
  const entradas = enderecosLivresClasse(variaveis, 'entrada', ignorarNome)
  const saidas = enderecosLivresClasse(variaveis, 'saida', ignorarNome)
  return (
    <>
      <option value="">Sem endereço (interna)</option>
      <optgroup label="Entradas">
        {entradas.map((endereco) => (
          <option key={endereco} value={endereco}>
            {endereco}
          </option>
        ))}
      </optgroup>
      <optgroup label="Saídas">
        {saidas.map((endereco) => (
          <option key={endereco} value={endereco}>
            {endereco}
          </option>
        ))}
      </optgroup>
    </>
  )
}

interface FormularioNovaVariavelProps {
  variaveis: Variavel[]
  aoDeclarar: TabelaVariaveisProps['aoDeclarar']
}

function FormularioNovaVariavel({ variaveis, aoDeclarar }: FormularioNovaVariavelProps) {
  const [nome, setNome] = useState('')
  const [endereco, setEndereco] = useState('')

  function aoSubmeter(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    const nomeLimpo = nome.trim()
    if (nomeLimpo.length === 0) return

    aoDeclarar(endereco === '' ? { nome: nomeLimpo } : { nome: nomeLimpo, endereco })
    setNome('')
    setEndereco('')
  }

  return (
    <form onSubmit={aoSubmeter} className="border-b border-ide-borda px-3 py-2">
      <h3 className="text-xs font-semibold text-ide-texto">Adicionar variável</h3>
      <div className="mt-1.5 flex flex-col gap-1.5">
        <label className="flex flex-col gap-0.5 text-[11px] text-ide-suave">
          Nome
          <input
            type="text"
            aria-label="Nome da nova variável"
            value={nome}
            onChange={(evento) => setNome(evento.target.value)}
            className="rounded border border-ide-borda bg-ide-painel p-1 text-xs text-ide-texto"
          />
        </label>
        <label className="flex flex-col gap-0.5 text-[11px] text-ide-suave">
          Endereço
          <select
            aria-label="Endereço da nova variável"
            value={endereco}
            onChange={(evento) => setEndereco(evento.target.value)}
            className="rounded border border-ide-borda bg-ide-painel p-1 font-mono text-xs text-ide-texto"
          >
            <OpcoesEndereco variaveis={variaveis} />
          </select>
        </label>
        <button
          type="submit"
          className="mt-0.5 self-start rounded bg-ide-destaque px-2 py-1 text-[11px] font-medium text-ide-destaque-texto hover:opacity-90"
        >
          Adicionar
        </button>
      </div>
    </form>
  )
}

function ValorCelula({ nome, valor }: { nome: string; valor?: boolean }) {
  if (valor === undefined) {
    return (
      <span
        title="estado ao vivo disponível com a simulação (F9)"
        aria-label={`Valor de ${nome}: estado ao vivo disponível com a simulação (F9)`}
        className="font-mono text-ide-suave"
      >
        —
      </span>
    )
  }

  return (
    <span
      aria-label={`Valor de ${nome}: ${valor ? 'verdadeiro' : 'falso'}`}
      className={
        valor
          ? 'rounded bg-ide-sucesso px-1.5 py-0.5 font-mono text-[10px] font-semibold text-ide-fundo'
          : 'rounded bg-ide-elevado px-1.5 py-0.5 font-mono text-[10px] font-semibold text-ide-suave'
      }
    >
      {valor ? 'TRUE' : 'FALSE'}
    </span>
  )
}

interface LinhaVariavelProps {
  variavel: Variavel
  variaveis: Variavel[]
  valor?: boolean
  aoAtualizar: TabelaVariaveisProps['aoAtualizar']
  aoRemover: TabelaVariaveisProps['aoRemover']
}

function LinhaVariavel({ variavel, variaveis, valor, aoAtualizar, aoRemover }: LinhaVariavelProps) {
  const [nome, setNome] = useState(variavel.nome)
  /** Marca que o próximo `blur` é efeito do `Esc`, não deve confirmar — o
   * `blur` roda no mesmo fechamento (closure) que leu `nome` antes do
   * `setNome(variavel.nome)` ter efeito, então só um sinalizador (não o
   * estado) evita reenviar o valor antigo digitado. */
  const ignorarProximoBlur = useRef(false)

  function confirmarNome() {
    if (ignorarProximoBlur.current) {
      ignorarProximoBlur.current = false
      return
    }
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
    } else if (evento.key === 'Escape') {
      ignorarProximoBlur.current = true
      setNome(variavel.nome)
      evento.currentTarget.blur()
    }
  }

  function aoMudarEndereco(evento: ChangeEvent<HTMLSelectElement>) {
    const novoEndereco = evento.target.value
    aoAtualizar(variavel.nome, { nome: variavel.nome, endereco: novoEndereco === '' ? undefined : novoEndereco })
  }

  return (
    <tr className="border-t border-ide-borda">
      <td className="py-1 pr-1">
        <input
          type="text"
          aria-label={`Nome da variável ${variavel.nome}`}
          value={nome}
          onChange={(evento) => setNome(evento.target.value)}
          onBlur={confirmarNome}
          onKeyDown={aoTeclarNome}
          className="w-full min-w-0 rounded border border-ide-borda bg-ide-painel p-1 text-ide-texto"
        />
      </td>
      <td className="py-1 pr-1">
        <select
          aria-label={`Endereço da variável ${variavel.nome}`}
          value={variavel.endereco ?? ''}
          onChange={aoMudarEndereco}
          className="w-full min-w-0 rounded border border-ide-borda bg-ide-painel p-1 font-mono text-ide-texto"
        >
          <OpcoesEndereco variaveis={variaveis} ignorarNome={variavel.nome} />
        </select>
      </td>
      <td className="py-1 pr-1 font-mono text-ide-suave">BOOL</td>
      <td className="py-1 pr-1">
        <ValorCelula nome={variavel.nome} valor={valor} />
      </td>
      <td className="py-1 text-right">
        <button
          type="button"
          aria-label={`Remover variável ${variavel.nome}`}
          onClick={() => aoRemover(variavel.nome)}
          className="rounded px-1 text-ide-perigo hover:bg-ide-elevado"
        >
          ✕
        </button>
      </td>
    </tr>
  )
}

/** Rodapé recolhível: endereço → GPIO para os endereços localizados,
 * marcando os que já estão em uso por alguma variável. */
function MapaDePinos({ variaveis }: { variaveis: Variavel[] }) {
  const usados = new Set(variaveis.filter((v) => v.endereco !== undefined).map((v) => v.endereco as string))
  const enderecos = [...ENTRADAS_LOCALIZADAS, ...SAIDAS_LOCALIZADAS]

  return (
    <details className="border-t border-ide-borda px-3 py-2">
      <summary className="cursor-pointer select-none text-xs font-medium text-ide-suave">Mapa de pinos ESP32</summary>
      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-[11px]">
        {enderecos.map((endereco) => {
          const emUso = usados.has(endereco)
          return (
            <div key={endereco} className="flex items-center justify-between gap-1">
              <dt className={emUso ? 'text-ide-texto' : 'text-ide-suave'}>{endereco}</dt>
              <dd className={emUso ? 'text-ide-texto' : 'text-ide-suave'}>
                GPIO {GPIO_DO_ENDERECO[endereco]}
                {emUso && <span className="ml-1 text-ide-destaque">em uso</span>}
              </dd>
            </div>
          )
        })}
      </dl>
    </details>
  )
}

export default function TabelaVariaveis({ variaveis, valores, erro, aoDeclarar, aoAtualizar, aoRemover }: TabelaVariaveisProps) {
  const [filtro, setFiltro] = useState<ClasseFiltro>('todas')

  const visiveis = filtro === 'todas' ? variaveis : variaveis.filter((v) => classeDaVariavel(v) === filtro)

  return (
    <section aria-label="Variáveis" className="flex h-full flex-col overflow-hidden bg-ide-painel text-ide-texto">
      <header className="flex items-baseline justify-between gap-2 px-3 py-2">
        <h2 className="text-sm font-semibold">Variáveis</h2>
        <span className="text-xs text-ide-suave">
          {variaveis.length} declarada{variaveis.length === 1 ? '' : 's'}
        </span>
      </header>

      <div role="tablist" aria-label="Filtrar variáveis por classe" className="flex gap-1 border-b border-ide-borda px-2 pb-2">
        {ABAS.map((aba) => (
          <button
            key={aba}
            type="button"
            role="tab"
            aria-selected={filtro === aba}
            onClick={() => setFiltro(aba)}
            className={
              filtro === aba
                ? 'rounded px-2 py-0.5 text-xs font-medium bg-ide-destaque text-ide-destaque-texto'
                : 'rounded px-2 py-0.5 text-xs font-medium text-ide-suave hover:bg-ide-elevado'
            }
          >
            {ROTULO_ABA[aba]}
          </button>
        ))}
      </div>

      <FormularioNovaVariavel variaveis={variaveis} aoDeclarar={aoDeclarar} />

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
        {visiveis.length === 0 ? (
          <p className="py-4 text-center text-xs text-ide-suave">Nenhuma variável. Adicione acima.</p>
        ) : (
          <table className="w-full table-fixed border-collapse text-xs">
            <colgroup>
              <col className="w-[30%]" />
              <col className="w-[26%]" />
              <col className="w-[14%]" />
              <col className="w-[20%]" />
              <col className="w-[10%]" />
            </colgroup>
            <thead>
              <tr className="text-left text-[11px] font-medium text-ide-suave">
                <th scope="col" className="pb-1 pr-1 font-medium">
                  Nome
                </th>
                <th scope="col" className="pb-1 pr-1 font-medium">
                  Endereço
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
              {visiveis.map((variavel) => (
                <LinhaVariavel
                  key={variavel.nome}
                  variavel={variavel}
                  variaveis={variaveis}
                  valor={valores?.[variavel.nome]}
                  aoAtualizar={aoAtualizar}
                  aoRemover={aoRemover}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {erro && (
        <p role="alert" className="mx-3 mb-2 rounded border border-ide-perigo bg-ide-elevado p-2 text-xs text-ide-perigo">
          {erro}
        </p>
      )}

      <MapaDePinos variaveis={variaveis} />
    </section>
  )
}
