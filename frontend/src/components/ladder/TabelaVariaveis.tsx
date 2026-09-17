/**
 * Painel de variáveis — conteúdo visual (spec 002, plano D-14, tarefa #24,
 * frente V).
 *
 * Revisão sobre a tarefa #23: o autor relatou que só conseguia criar
 * variáveis de entrada ou de saída — a opção "Sem endereço (interna)" no
 * select passava despercebida — e que o rótulo "interna" era vago. O
 * formulário agora pede a classe primeiro, num controle segmentado
 * (`role="radiogroup"`) com três opções sempre visíveis — **Entrada | Saída |
 * Memória** — e só então mostra o seletor de pino (Entrada/Saída) ou uma
 * frase curta explicando o que é "Memória". A palavra "interna" não aparece
 * mais na interface: o valor de classe continua `'interna'` (tipo
 * `ClasseVariavel` de `enderecos.ts`, fora do escopo desta frente), só o
 * rótulo mudou.
 *
 * O seletor de pino também ganhou o GPIO físico ao lado do endereço IEC
 * (`GPIO 19 · %IX0.2`) — antes só o endereço aparecia, e o autor não
 * enxergava a correspondência com o hardware sem abrir o mapa de pinos.
 *
 * Quem monta este componente na IDE e fala com o núcleo é
 * `PainelVariaveis.tsx`: este arquivo é puramente controlado pelas props,
 * sem tocar `edicao.ts` diretamente.
 *
 * "Tipo" não é mais uma escolha: todo dado é `BOOL` (Q-5/D-2), então a coluna
 * só exibe o texto fixo. A classe (entrada/saída/memória) continua derivada
 * do endereço (`enderecos.ts`) e só aparece aqui como filtro em abas — trocar
 * de classe é trocar de endereço, no próprio select da coluna Pino (o núcleo
 * permite ir de entrada para saída e vice-versa, ou para Memória).
 *
 * "Valor" é o estado ao vivo da variável — hoje sem fonte (chega com o
 * simulador, F9). A prop opcional `valores` já deixa a célula pronta: sem ela
 * (ou sem entrada para o nome), mostra "—" com dica acessível; com ela,
 * mostra o booleano em selo `TRUE`/`FALSE`.
 *
 * Só tokens de tema (`index.css`, `bg-ide-*`/`text-ide-*`/`border-ide-*`) —
 * nenhuma cor Tailwind fixa (`slate-*`, `sky-*`, `red-*`...).
 *
 * Revisão (mesma tarefa #24, achados do orquestrador em Chromium real
 * 1440×900): a célula "Pino" mostrava o texto (GPIO + endereço) e o
 * `<select>` ao mesmo tempo, um embaixo do outro, dobrando a altura da linha
 * e repetindo a informação — agora o select só aparece ao acionar um botão
 * de edição discreto (`PinoCelula`). E o `<details>` do mapa de pinos, fora
 * da área rolável da lista, crescia por conta própria ao abrir e espremia o
 * cabeçalho da tabela — agora formulário, lista e mapa dividem uma única
 * área `overflow-y-auto`, com só o cabeçalho "Variáveis" e as abas fixos.
 *
 * **Nenhuma mensagem em texto (tarefa #25):** o `<p role="alert">` que
 * mostrava a recusa do núcleo (nome duplicado, endereço em uso...) saiu —
 * junto a prop `erro`. `PainelVariaveis` é quem decide o que fazer com uma
 * recusa agora, via `aoRecusar`; este componente não sabe mais nada sobre
 * recusa nenhuma.
 */
import {
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
} from 'react'

import { Pencil, Plus, Trash2 } from 'lucide-react'

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
  interna: 'Memórias',
}

const CLASSES_COM_PINO: readonly ('entrada' | 'saida')[] = ['entrada', 'saida']

const ROTULO_CLASSE_PINO: Record<'entrada' | 'saida', string> = {
  entrada: 'Entrada',
  saida: 'Saída',
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

/** Rótulo de uma `<option>` de pino: GPIO físico primeiro (o que o autor
 * reconhece no hardware), endereço IEC depois — `<option>` não aceita estilo
 * parcial, então os dois ficam no mesmo texto, separados por "·". */
function rotuloOpcaoPino(endereco: string): string {
  return `GPIO ${GPIO_DO_ENDERECO[endereco]} · ${endereco}`
}

/** Opções do select de pino usado na edição de uma linha da lista: "Memória
 * (sem pino)" + livres das duas classes (o núcleo permite trocar
 * entrada↔saída, então as duas aparecem, não só a da variável atual). */
function OpcoesPino({ variaveis, ignorarNome }: { variaveis: Variavel[]; ignorarNome?: string }) {
  const entradas = enderecosLivresClasse(variaveis, 'entrada', ignorarNome)
  const saidas = enderecosLivresClasse(variaveis, 'saida', ignorarNome)
  return (
    <>
      <option value="">Memória (sem pino)</option>
      <optgroup label="Entradas">
        {entradas.map((endereco) => (
          <option key={endereco} value={endereco}>
            {rotuloOpcaoPino(endereco)}
          </option>
        ))}
      </optgroup>
      <optgroup label="Saídas">
        {saidas.map((endereco) => (
          <option key={endereco} value={endereco}>
            {rotuloOpcaoPino(endereco)}
          </option>
        ))}
      </optgroup>
    </>
  )
}

interface SeletorClasseProps {
  valor: ClasseVariavel
  aoMudar: (classe: ClasseVariavel) => void
}

const OPCOES_CLASSE: { valor: ClasseVariavel; rotulo: string }[] = [
  { valor: 'entrada', rotulo: 'Entrada' },
  { valor: 'saida', rotulo: 'Saída' },
  { valor: 'interna', rotulo: 'Memória' },
]

/** Controle segmentado Entrada | Saída | Memória (D-14): antes a única forma
 * de declarar uma variável sem pino era um item quase invisível no fim de um
 * select ("Sem endereço (interna)"), e o autor relatou só conseguir criar
 * entrada ou saída. As três opções ficam sempre visíveis, com navegação por
 * setas como um `radiogroup` padrão (foco acompanha a opção marcada só
 * quando o foco já estava dentro do grupo, para não roubar foco em cliques). */
function SeletorClasse({ valor, aoMudar }: SeletorClasseProps) {
  const grupoRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const grupo = grupoRef.current
    if (!grupo || !grupo.contains(document.activeElement)) return
    const marcado = grupo.querySelector<HTMLButtonElement>('[aria-checked="true"]')
    marcado?.focus()
  }, [valor])

  function aoTeclar(evento: KeyboardEvent<HTMLDivElement>) {
    const indiceAtual = OPCOES_CLASSE.findIndex((o) => o.valor === valor)
    if (evento.key === 'ArrowRight' || evento.key === 'ArrowDown') {
      evento.preventDefault()
      aoMudar(OPCOES_CLASSE[(indiceAtual + 1) % OPCOES_CLASSE.length].valor)
    } else if (evento.key === 'ArrowLeft' || evento.key === 'ArrowUp') {
      evento.preventDefault()
      aoMudar(OPCOES_CLASSE[(indiceAtual - 1 + OPCOES_CLASSE.length) % OPCOES_CLASSE.length].valor)
    }
  }

  return (
    <div
      ref={grupoRef}
      role="radiogroup"
      aria-label="Classe da nova variável"
      onKeyDown={aoTeclar}
      className="flex gap-1"
    >
      {OPCOES_CLASSE.map((opcao) => {
        const marcado = valor === opcao.valor
        return (
          <button
            key={opcao.valor}
            type="button"
            role="radio"
            aria-checked={marcado}
            tabIndex={marcado ? 0 : -1}
            onClick={() => aoMudar(opcao.valor)}
            className={
              marcado
                ? 'flex-1 rounded bg-ide-destaque px-2 py-1 text-[11px] font-medium text-ide-destaque-texto'
                : 'flex-1 rounded border border-ide-borda px-2 py-1 text-[11px] font-medium text-ide-suave hover:bg-ide-elevado'
            }
          >
            {opcao.rotulo}
          </button>
        )
      })}
    </div>
  )
}

interface FormularioNovaVariavelProps {
  variaveis: Variavel[]
  aoDeclarar: TabelaVariaveisProps['aoDeclarar']
}

function FormularioNovaVariavel({ variaveis, aoDeclarar }: FormularioNovaVariavelProps) {
  const idMotivoSemPino = useId()
  const [nome, setNome] = useState('')
  const [classe, setClasse] = useState<ClasseVariavel>('entrada')
  const [endereco, setEndereco] = useState<string>(() => enderecosLivresClasse(variaveis, 'entrada')[0] ?? '')

  const temPino = CLASSES_COM_PINO.includes(classe as 'entrada' | 'saida')
  const livres = temPino ? enderecosLivresClasse(variaveis, classe as 'entrada' | 'saida') : []
  const semPinoLivre = temPino && livres.length === 0

  useEffect(() => {
    if (!temPino) return
    if (!livres.includes(endereco)) setEndereco(livres[0] ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `livres` deriva de `classe`+`variaveis`, já nas deps
  }, [classe, variaveis])

  function aoSubmeter(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    const nomeLimpo = nome.trim()
    if (nomeLimpo.length === 0) return
    if (temPino) {
      if (endereco === '') return
      aoDeclarar({ nome: nomeLimpo, endereco })
    } else {
      aoDeclarar({ nome: nomeLimpo })
    }
    setNome('')
  }

  const desabilitado = nome.trim().length === 0 || semPinoLivre

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

        <div className="flex flex-col gap-0.5 text-[11px] text-ide-suave">
          Classe
          <SeletorClasse valor={classe} aoMudar={setClasse} />
        </div>

        {temPino ? (
          <label className="flex flex-col gap-0.5 text-[11px] text-ide-suave">
            Pino
            <select
              aria-label="Pino da nova variável"
              value={endereco}
              onChange={(evento) => setEndereco(evento.target.value)}
              disabled={semPinoLivre}
              className="rounded border border-ide-borda bg-ide-painel p-1 font-mono text-xs text-ide-texto disabled:opacity-50"
            >
              {livres.length === 0 ? (
                <option value="">Nenhum pino livre</option>
              ) : (
                livres.map((end) => (
                  <option key={end} value={end}>
                    {rotuloOpcaoPino(end)}
                  </option>
                ))
              )}
            </select>
          </label>
        ) : (
          <p className="text-[11px] text-ide-suave">Memória: variável sem pino físico, usada na lógica.</p>
        )}

        {semPinoLivre && (
          <p id={idMotivoSemPino} className="text-[11px] text-ide-perigo">
            Nenhum pino de {ROTULO_CLASSE_PINO[classe as 'entrada' | 'saida']} livre para declarar.
          </p>
        )}

        <button
          type="submit"
          disabled={desabilitado}
          aria-describedby={semPinoLivre ? idMotivoSemPino : undefined}
          className="mt-0.5 inline-flex w-fit items-center gap-1 rounded bg-ide-destaque px-2 py-1 text-[11px] font-medium text-ide-destaque-texto hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus aria-hidden="true" size={12} />
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

/** Célula "Pino": uma linha só. Em repouso, mostra GPIO + endereço discreto
 * (ou o selo "Memória") como botão de edição — o lápis só aparece ao passar
 * o mouse/focar, mas o `aria-label` já avisa a ação para leitor de tela. Um
 * clique troca o botão pelo `<select>` (foco automático); escolher uma opção
 * aplica e volta à exibição; Esc ou blur sem mudança só fecham a edição, sem
 * chamar o núcleo. Antes texto e select apareciam juntos, um embaixo do
 * outro, dobrando a altura da linha e repetindo a mesma informação. */
function PinoCelula({
  variavel,
  variaveis,
  aoAtualizar,
}: {
  variavel: Variavel
  variaveis: Variavel[]
  aoAtualizar: TabelaVariaveisProps['aoAtualizar']
}) {
  const [editando, setEditando] = useState(false)
  const selectRef = useRef<HTMLSelectElement>(null)

  useEffect(() => {
    if (editando) selectRef.current?.focus()
  }, [editando])

  function aoMudarPino(evento: ChangeEvent<HTMLSelectElement>) {
    const novoEndereco = evento.target.value
    aoAtualizar(variavel.nome, { nome: variavel.nome, endereco: novoEndereco === '' ? undefined : novoEndereco })
    setEditando(false)
  }

  function aoTeclarPino(evento: KeyboardEvent<HTMLSelectElement>) {
    if (evento.key === 'Escape') {
      evento.preventDefault()
      setEditando(false)
    }
  }

  if (editando) {
    return (
      <select
        ref={selectRef}
        aria-label={`Pino da variável ${variavel.nome}`}
        value={variavel.endereco ?? ''}
        onChange={aoMudarPino}
        onBlur={() => setEditando(false)}
        onKeyDown={aoTeclarPino}
        className="w-full min-w-0 rounded border border-ide-borda bg-ide-painel p-1 font-mono text-[11px] text-ide-texto"
      >
        <OpcoesPino variaveis={variaveis} ignorarNome={variavel.nome} />
      </select>
    )
  }

  return (
    <button
      type="button"
      onClick={() => setEditando(true)}
      aria-label={`Alterar pino de ${variavel.nome}`}
      className="group flex w-full items-center gap-1 rounded px-0.5 py-0.5 text-left hover:bg-ide-elevado focus:bg-ide-elevado focus:outline-none"
    >
      {variavel.endereco === undefined ? (
        <span className="w-fit rounded bg-ide-elevado px-1.5 py-0.5 text-[10px] font-semibold text-ide-suave">
          Memória
        </span>
      ) : (
        <span className="flex items-baseline gap-1 text-ide-texto">
          <span>GPIO {GPIO_DO_ENDERECO[variavel.endereco]}</span>
          <span className="font-mono text-[10px] text-ide-suave">{variavel.endereco}</span>
        </span>
      )}
      <Pencil
        aria-hidden="true"
        size={11}
        className="ml-auto shrink-0 text-ide-suave opacity-0 group-hover:opacity-100 group-focus:opacity-100"
      />
    </button>
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

  return (
    <tr className="border-t border-ide-borda">
      <td className="py-1 pr-1 align-top">
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
      <td className="py-1 pr-1 align-top">
        <PinoCelula variavel={variavel} variaveis={variaveis} aoAtualizar={aoAtualizar} />
      </td>
      <td className="py-1 pr-1 align-top font-mono text-ide-suave">BOOL</td>
      <td className="py-1 pr-1 align-top">
        <ValorCelula nome={variavel.nome} valor={valor} />
      </td>
      <td className="py-1 text-right align-top">
        <button
          type="button"
          aria-label={`Remover variável ${variavel.nome}`}
          onClick={() => aoRemover(variavel.nome)}
          className="rounded p-1 text-ide-perigo hover:bg-ide-elevado"
        >
          <Trash2 aria-hidden="true" size={14} />
        </button>
      </td>
    </tr>
  )
}

/** Uma das duas tabelas do mapa de pinos (Entradas ou Saídas): uma linha por
 * endereço localizado, com o nome da variável que o usa ou "livre". Antes as
 * duas classes ficavam lado a lado numa grade de 2 colunas com pouco
 * espaçamento — o autor achou os rótulos colados; agora cada classe tem sua
 * própria tabela, com célula de verdade (padding, divisores, zebra). */
function TabelaMapa({
  titulo,
  enderecos,
  variaveis,
}: {
  titulo: string
  enderecos: readonly string[]
  variaveis: Variavel[]
}) {
  function variavelDoEndereco(endereco: string): Variavel | undefined {
    return variaveis.find((v) => v.endereco === endereco)
  }

  return (
    <div>
      <h4 className="mb-1 text-[11px] font-semibold text-ide-texto">{titulo}</h4>
      <table className="w-full border-collapse text-[11px]">
        <thead>
          <tr className="text-left text-ide-suave">
            <th scope="col" className="border-b border-ide-borda py-1 pr-3 font-medium">
              Endereço
            </th>
            <th scope="col" className="border-b border-ide-borda py-1 pr-3 font-medium">
              GPIO
            </th>
            <th scope="col" className="border-b border-ide-borda py-1 font-medium">
              Variável
            </th>
          </tr>
        </thead>
        <tbody>
          {enderecos.map((endereco, indice) => {
            const variavel = variavelDoEndereco(endereco)
            return (
              <tr key={endereco} className={indice % 2 === 1 ? 'bg-ide-elevado' : undefined}>
                <td className="py-1 pr-3 font-mono text-ide-texto">{endereco}</td>
                <td className="py-1 pr-3 font-mono text-ide-texto">GPIO {GPIO_DO_ENDERECO[endereco]}</td>
                <td className="py-1">
                  {variavel ? (
                    <span className="text-ide-texto">{variavel.nome}</span>
                  ) : (
                    <span className="text-ide-suave">livre</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/** Rodapé recolhível: duas tabelas separadas, Entradas e Saídas. */
function MapaDePinos({ variaveis }: { variaveis: Variavel[] }) {
  return (
    <details className="border-t border-ide-borda px-3 py-2">
      <summary className="cursor-pointer select-none text-xs font-medium text-ide-suave">Mapa de pinos ESP32</summary>
      <div className="mt-2 flex flex-col gap-3">
        <TabelaMapa titulo="Entradas" enderecos={ENTRADAS_LOCALIZADAS} variaveis={variaveis} />
        <TabelaMapa titulo="Saídas" enderecos={SAIDAS_LOCALIZADAS} variaveis={variaveis} />
      </div>
    </details>
  )
}

export default function TabelaVariaveis({ variaveis, valores, aoDeclarar, aoAtualizar, aoRemover }: TabelaVariaveisProps) {
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

      {/* Área rolável única: formulário, lista e mapa de pinos ficam no
       * fluxo normal aqui dentro — antes o mapa (um `<details>` fora dessa
       * área) crescia por conta própria ao abrir e espremia a lista contra
       * o cabeçalho da tabela, dando a impressão de sobrepor o cabeçalho
       * "Nome Pino Tipo Valor". Só o cabeçalho "Variáveis" e as abas acima
       * ficam fixos. */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <FormularioNovaVariavel variaveis={variaveis} aoDeclarar={aoDeclarar} />

        <div className="px-3 py-2">
          {visiveis.length === 0 ? (
            <p className="py-4 text-center text-xs text-ide-suave">Nenhuma variável. Adicione acima.</p>
          ) : (
            <table aria-label="Variáveis declaradas" className="w-full table-fixed border-collapse text-xs">
              <colgroup>
                <col className="w-[26%]" />
                <col className="w-[32%]" />
                <col className="w-[12%]" />
                <col className="w-[18%]" />
                <col className="w-[12%]" />
              </colgroup>
              <thead>
                <tr className="text-left text-[11px] font-medium text-ide-suave">
                  <th scope="col" className="pb-1 pr-1 font-medium">
                    Nome
                  </th>
                  <th scope="col" className="pb-1 pr-1 font-medium">
                    Pino
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

        <MapaDePinos variaveis={variaveis} />
      </div>
    </section>
  )
}
