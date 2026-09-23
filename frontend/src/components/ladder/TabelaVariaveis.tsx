/**
 * Conteúdo visual do painel de variáveis (spec 002, plano D-14, tarefas
 * #24/#25, revisão tarefa #26, frente L).
 *
 * Tarefa #26: passou brevemente por uma aba de largura inteira e voltou ao
 * painel lateral estreito (18–40rem, `PainelLateral`) por pedido do autor
 * depois de testar a versão em aba. A tabela ganhou uma coluna nova, "Uso"
 * (Entrada/Saída/Memória, com cor discreta por classe) — antes essa
 * informação só aparecia embutida no texto da coluna "Pino" (um selo
 * "Memória" quando não havia endereço). Com a coluna própria, "Pino" volta a
 * falar só de hardware: "GPIO n" + endereço, ou "—" quando a variável é
 * Memória. A referência visual (`.claude/references/modelo_vars.png`,
 * inspiração de layout, sem cópia de código) mostra uma tabela de tags com
 * uma linha "Add Tag..." fixa no fim — aqui virou a linha "Adicionar
 * variável" (última do corpo da tabela, sempre visível, mesmo com a lista
 * vazia ou filtrada a zero linhas); no painel estreito, o mapa de pinos
 * empilha as duas tabelas (Entradas/Saídas).
 *
 * Quem monta este componente e fala com o núcleo é `PainelVariaveis.tsx`:
 * este arquivo é puramente controlado pelas props, sem tocar `edicao.ts`
 * diretamente.
 *
 * "Tipo" não é uma escolha: todo dado é `BOOL` (Q-5/D-2), então a coluna só
 * exibe o texto fixo, na linha existente e na linha de adicionar. A classe
 * (entrada/saída/memória) é derivada do endereço (`enderecos.ts`); trocar de
 * classe é trocar de endereço, no seletor da própria coluna "Pino" (o núcleo
 * permite ir de entrada para saída e vice-versa, ou para Memória).
 *
 * "Valor" é o estado ao vivo da variável (spec 004, tarefa #12): a prop
 * `valores`, reservada desde a tarefa #23, chega preenchida com a simulação
 * ativa — sem ela (ou sem entrada para o nome), a célula mostra "—" com dica
 * acessível, como sempre; com ela, mostra o booleano em selo `TRUE`/`FALSE`.
 * Para variáveis de **entrada**, o selo vira um botão (`aoAcionar`,
 * RF-12/CA-9): clicável e operável por teclado (`role="switch"`,
 * `aria-checked`), aciona o nível oposto ao mostrado. Saída e memória
 * continuam só leitura — mostram o valor e não respondem a clique nenhum,
 * mesma aparência de selo de sempre. Nenhuma mudança de layout: é a mesma
 * célula, só troca `<span>` por `<button>` quando é entrada e há
 * `aoAcionar`.
 *
 * A contagem de ciclos (`ciclo`, RF-13) aparece no cabeçalho, ao lado da
 * contagem de variáveis declaradas — sóbria, sem linha nova nem mudança de
 * layout — só quando a simulação está ativa (`ciclo !== undefined`).
 *
 * Só tokens de tema (`index.css`, `bg-ide-*`/`text-ide-*`/`border-ide-*`) —
 * nenhuma cor Tailwind fixa (`slate-*`, `sky-*`, `red-*`...).
 *
 * **Nenhuma mensagem em texto (tarefa #25):** não há `role="alert"` aqui — a
 * recusa do núcleo (nome duplicado, endereço em uso...) é responsabilidade de
 * `PainelVariaveis`, via `aoRecusar`; este componente não sabe nada sobre
 * recusa nenhuma.
 *
 * **Bloqueio durante a simulação (spec 002, revisão 2026-09-23 — simetria
 * com o contrato de E/S do ambiente):** `simulacaoAtiva` desabilita a linha
 * "Adicionar" inteira, o campo de nome, o botão "Alterar pino" e "Remover"
 * de cada linha existente — a leitura (nomes, uso, pino, valor, mapa de
 * pinos) continua sempre disponível, só a mutação é bloqueada. Cada controle
 * desabilitado leva `title` com o motivo (`MOTIVO_SIMULACAO_*`, exportados
 * para `PainelVariaveis` reusar na recusa defensiva). Antes desta revisão, a
 * tabela era a única superfície do app que ainda liberava
 * criar/renomear/repinar/remover variável durante a simulação — assimetria
 * registrada em `.claude/state.md` sob a F9.
 */
import {
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
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
  /** Estado ao vivo por nome de variável — preenchido com a simulação ativa
   * (spec 004, tarefa #12); ausente/sem entrada para o nome é "—", como hoje. */
  valores?: Record<string, boolean>
  /** Aciona uma variável de **entrada** manualmente (RF-12); saída e memória
   * ignoram esta prop — nunca ficam acionáveis, mesmo se ela vier definida
   * (a checagem de classe é feita aqui, não por quem chama). */
  aoAcionar?: (nome: string, nivel: boolean) => void
  /** Ciclos decorridos da simulação (RF-13) — mostrado no cabeçalho só
   * quando definido (simulação ativa); ausente é o cabeçalho de hoje. */
  ciclo?: number
  enderecosComandadosPelaPlanta?: readonly string[]
  motivoEntradaPlanta?: string
  aoDeclarar: (v: { nome: string; endereco?: string }) => void
  aoAtualizar: (nomeAtual: string, v: { nome: string; endereco?: string }) => void
  aoRemover: (nome: string) => void
  /** Simulação ativa (spec 004, Q-7) — desabilita criar, renomear, trocar
   * pino e remover (revisão 2026-09-23); ausente/`false` é o comportamento
   * de sempre. A leitura nunca é bloqueada. */
  simulacaoAtiva?: boolean
}

/** Motivos do bloqueio durante a simulação — mesmo padrão de frase do
 * contrato de E/S do ambiente (`App.tsx`, `MOTIVO_CRIACAO_EM_SIMULACAO`:
 * "Saia da simulação para criar variáveis"), um por verbo para o `title`
 * ficar específico da ação bloqueada. Exportados para `PainelVariaveis`
 * usar na recusa defensiva (`aoRecusar`), sem duplicar o texto. */
export const MOTIVO_SIMULACAO_CRIAR = 'Saia da simulação para criar variáveis'
export const MOTIVO_SIMULACAO_EDITAR = 'Saia da simulação para editar variáveis'
export const MOTIVO_SIMULACAO_REMOVER = 'Saia da simulação para remover variáveis'

type ClasseFiltro = ClasseVariavel | 'todas'

const ABAS: ClasseFiltro[] = ['todas', 'entrada', 'saida', 'interna']

const ROTULO_ABA: Record<ClasseFiltro, string> = {
  todas: 'Todas',
  entrada: 'Entradas',
  saida: 'Saídas',
  interna: 'Memórias',
}

/** Rótulo e cor discreta da coluna "Uso" — a mesma classe (`enderecos.ts`)
 * que já decide a aba de filtro, só que exibida por linha. Cores tímidas
 * (sem fundo, só o texto) para não competir com o zebrado da tabela. */
const ROTULO_USO: Record<ClasseVariavel, string> = {
  entrada: 'Entrada',
  saida: 'Saída',
  interna: 'Memória',
}

const COR_USO: Record<ClasseVariavel, string> = {
  entrada: 'text-ide-previa',
  saida: 'text-ide-sucesso',
  interna: 'text-ide-suave',
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
  /** Bloqueado durante a simulação (revisão 2026-09-23) — as três opções
   * ficam com `disabled` e o `title` do motivo, sem sumir do DOM. */
  desabilitado?: boolean
  motivoBloqueio?: string
}

const OPCOES_CLASSE: { valor: ClasseVariavel; rotulo: string }[] = [
  { valor: 'entrada', rotulo: 'Entrada' },
  { valor: 'saida', rotulo: 'Saída' },
  { valor: 'interna', rotulo: 'Memória' },
]

/** Controle segmentado Entrada | Saída | Memória (D-14): as três opções ficam
 * sempre visíveis, com navegação por setas como um `radiogroup` padrão (foco
 * acompanha a opção marcada só quando o foco já estava dentro do grupo, para
 * não roubar foco em cliques). Usado tanto na linha de adicionar quanto —
 * potencialmente — em qualquer outro lugar que precise escolher a classe.
 * `flex-wrap` (achado na verificação em Chromium real, painel lateral
 * estreito): sem ele, os três botões vazavam da própria célula da tabela e
 * sobrepunham o `<select>` de Pino ao lado, roubando o clique. */
function SeletorClasse({ valor, aoMudar, desabilitado, motivoBloqueio }: SeletorClasseProps) {
  const grupoRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const grupo = grupoRef.current
    if (!grupo || !grupo.contains(document.activeElement)) return
    const marcado = grupo.querySelector<HTMLButtonElement>('[aria-checked="true"]')
    marcado?.focus()
  }, [valor])

  function aoTeclar(evento: KeyboardEvent<HTMLDivElement>) {
    if (desabilitado) return
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
      aria-disabled={desabilitado || undefined}
      onKeyDown={aoTeclar}
      className="flex flex-wrap gap-1"
    >
      {OPCOES_CLASSE.map((opcao) => {
        const marcado = valor === opcao.valor
        return (
          <button
            key={opcao.valor}
            type="button"
            role="radio"
            aria-checked={marcado}
            disabled={desabilitado}
            title={desabilitado ? motivoBloqueio : undefined}
            tabIndex={desabilitado ? -1 : marcado ? 0 : -1}
            onClick={() => aoMudar(opcao.valor)}
            className={
              (marcado
                ? 'rounded bg-ide-destaque px-2 py-1 text-[11px] font-medium text-ide-destaque-texto'
                : 'rounded border border-ide-borda px-2 py-1 text-[11px] font-medium text-ide-suave hover:bg-ide-elevado') +
              ' disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent'
            }
          >
            {opcao.rotulo}
          </button>
        )
      })}
    </div>
  )
}

/** Classes do selo de valor, compartilhadas entre a variante só-leitura
 * (`<span>`) e a acionável (`<button>`, entrada) — mesmo desenho visual nos
 * dois casos, só muda se responde a clique. */
function classeSeloValor(valor: boolean): string {
  return valor
    ? 'rounded bg-ide-sucesso px-1.5 py-0.5 font-mono text-[10px] font-semibold text-ide-fundo'
    : 'rounded bg-ide-elevado px-1.5 py-0.5 font-mono text-[10px] font-semibold text-ide-suave'
}

function ValorCelula({
  nome,
  valor,
  acionavel,
  tituloBloqueio,
  aoAcionar,
}: {
  nome: string
  valor?: boolean
  /** Só variáveis de entrada chegam com isto `true` (decidido por quem
   * monta a linha, via `classeDaVariavel`) — RF-12/CA-9. */
  acionavel?: boolean
  tituloBloqueio?: string
  aoAcionar?: (nivel: boolean) => void
}) {
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

  if (acionavel && aoAcionar) {
    return (
      <button
        type="button"
        role="switch"
        aria-checked={valor}
        aria-label={`Acionar ${nome} (${valor ? 'verdadeiro' : 'falso'})`}
        title="Clique para acionar — o novo nível vale a partir do próximo ciclo"
        onClick={() => aoAcionar(!valor)}
        className={`${classeSeloValor(valor)} cursor-pointer outline-none hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ide-destaque`}
      >
        {valor ? 'TRUE' : 'FALSE'}
      </button>
    )
  }

  return (
    <span
      title={tituloBloqueio}
      aria-label={`Valor de ${nome}: ${valor ? 'verdadeiro' : 'falso'}`}
      className={classeSeloValor(valor)}
    >
      {valor ? 'TRUE' : 'FALSE'}
    </span>
  )
}

/** Célula "Uso": só leitura, deriva a classe do endereço e mostra o rótulo com
 * uma cor discreta (só o texto, sem fundo — o zebrado da linha já cuida do
 * contraste). */
function UsoCelula({ variavel }: { variavel: Variavel }) {
  const classe = classeDaVariavel(variavel)
  return <span className={`text-xs font-medium ${COR_USO[classe]}`}>{ROTULO_USO[classe]}</span>
}

/** Célula "Pino": uma linha só, só de hardware (a classe já mora na coluna
 * "Uso"). Em repouso, mostra GPIO + endereço discreto (ou "—" para Memória)
 * como botão de edição — o lápis só aparece ao passar o mouse/focar, mas o
 * `aria-label` já avisa a ação para leitor de tela. Um clique troca o botão
 * pelo `<select>` (foco automático); escolher uma opção aplica e volta à
 * exibição; Esc ou blur sem mudança só fecham a edição, sem chamar o núcleo. */
function PinoCelula({
  variavel,
  variaveis,
  aoAtualizar,
  simulacaoAtiva,
}: {
  variavel: Variavel
  variaveis: Variavel[]
  aoAtualizar: TabelaVariaveisProps['aoAtualizar']
  simulacaoAtiva?: boolean
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
      disabled={simulacaoAtiva}
      aria-label={`Alterar pino de ${variavel.nome}`}
      title={simulacaoAtiva ? MOTIVO_SIMULACAO_EDITAR : undefined}
      className="group flex w-full items-center gap-1 rounded px-0.5 py-0.5 text-left hover:bg-ide-elevado focus:bg-ide-elevado focus:outline-none disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-transparent"
    >
      {variavel.endereco === undefined ? (
        <span className="text-ide-suave">—</span>
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
  /** Repassado só para a variável ser de entrada (`ValorCelula` decide o
   * `role="switch"`) — RF-12/CA-9. */
  aoAcionar?: (nome: string, nivel: boolean) => void
  bloqueadaPelaPlanta?: boolean
  motivoBloqueioPlanta?: string
  zebra: boolean
  aoAtualizar: TabelaVariaveisProps['aoAtualizar']
  aoRemover: TabelaVariaveisProps['aoRemover']
  /** Bloqueia renomear, trocar pino e remover (revisão 2026-09-23). */
  simulacaoAtiva?: boolean
}

function LinhaVariavel({
  variavel,
  variaveis,
  valor,
  aoAcionar,
  bloqueadaPelaPlanta,
  motivoBloqueioPlanta,
  zebra,
  aoAtualizar,
  aoRemover,
  simulacaoAtiva,
}: LinhaVariavelProps) {
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
    if (simulacaoAtiva) {
      setNome(variavel.nome)
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
    <tr className={`border-t border-ide-borda ${zebra ? 'bg-ide-elevado/40' : ''}`}>
      <td className="px-4 py-1.5 align-top">
        <input
          type="text"
          aria-label={`Nome da variável ${variavel.nome}`}
          value={nome}
          onChange={(evento) => setNome(evento.target.value)}
          onBlur={confirmarNome}
          onKeyDown={aoTeclarNome}
          disabled={simulacaoAtiva}
          title={simulacaoAtiva ? MOTIVO_SIMULACAO_EDITAR : undefined}
          className="w-full min-w-0 rounded border border-ide-borda bg-ide-painel p-1 text-sm text-ide-texto disabled:cursor-not-allowed disabled:opacity-60"
        />
      </td>
      <td className="py-1.5 pr-2 align-top">
        <ValorCelula
          nome={variavel.nome}
          valor={valor}
          acionavel={classeDaVariavel(variavel) === 'entrada' && !bloqueadaPelaPlanta}
          tituloBloqueio={bloqueadaPelaPlanta ? motivoBloqueioPlanta : undefined}
          aoAcionar={aoAcionar ? (nivel) => aoAcionar(variavel.nome, nivel) : undefined}
        />
      </td>
      <td className="py-1.5 pr-2 align-top font-mono text-xs text-ide-suave">BOOL</td>
      <td className="py-1.5 pr-2 align-top">
        <UsoCelula variavel={variavel} />
      </td>
      <td className="py-1.5 pr-2 align-top">
        <PinoCelula variavel={variavel} variaveis={variaveis} aoAtualizar={aoAtualizar} simulacaoAtiva={simulacaoAtiva} />
      </td>
      <td className="py-1.5 pr-4 align-top text-right">
        <button
          type="button"
          aria-label={`Remover variável ${variavel.nome}`}
          title={simulacaoAtiva ? MOTIVO_SIMULACAO_REMOVER : undefined}
          onClick={() => aoRemover(variavel.nome)}
          disabled={simulacaoAtiva}
          className="rounded p-1 text-ide-perigo hover:bg-ide-elevado disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
        >
          <Trash2 aria-hidden="true" size={14} />
        </button>
      </td>
    </tr>
  )
}

/** Última linha da tabela, sempre visível (mesmo com a lista vazia ou
 * filtrada a zero linhas — filtro afeta só as linhas de variáveis
 * existentes, não esta): os mesmos campos do formulário antigo, agora
 * alinhados por coluna, inspirados na linha "Add Tag..." da referência
 * visual. Não é um `<form>` — `<tr>` não aceita `<form>` como filho segundo o
 * modelo de conteúdo de tabela — a confirmação sai por clique no botão ou
 * Enter no campo de nome, os dois chamando a mesma função. */
function LinhaAdicionar({
  variaveis,
  aoDeclarar,
  simulacaoAtiva,
}: {
  variaveis: Variavel[]
  aoDeclarar: TabelaVariaveisProps['aoDeclarar']
  /** Bloqueia a linha inteira (revisão 2026-09-23) — mesmo o campo de nome,
   * para o Enter não escapar do bloqueio do botão. */
  simulacaoAtiva?: boolean
}) {
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

  function submeter() {
    if (simulacaoAtiva) return
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

  function aoTeclarNome(evento: KeyboardEvent<HTMLInputElement>) {
    if (evento.key === 'Enter') {
      evento.preventDefault()
      submeter()
    }
  }

  const desabilitado = nome.trim().length === 0 || semPinoLivre || simulacaoAtiva

  return (
    <tr className="border-t border-ide-borda bg-ide-elevado/30">
      <td className="px-4 py-1.5 align-top">
        <input
          type="text"
          aria-label="Nome da nova variável"
          placeholder="Adicionar variável…"
          value={nome}
          onChange={(evento) => setNome(evento.target.value)}
          onKeyDown={aoTeclarNome}
          disabled={simulacaoAtiva}
          title={simulacaoAtiva ? MOTIVO_SIMULACAO_CRIAR : undefined}
          className="w-full min-w-0 rounded border border-ide-borda bg-ide-painel p-1 text-sm text-ide-texto placeholder:text-ide-suave disabled:cursor-not-allowed disabled:opacity-60"
        />
      </td>
      <td className="py-1.5 pr-2 align-top font-mono text-xs text-ide-suave">—</td>
      <td className="py-1.5 pr-2 align-top font-mono text-xs text-ide-suave">BOOL</td>
      <td className="py-1.5 pr-2 align-top">
        <SeletorClasse valor={classe} aoMudar={setClasse} desabilitado={simulacaoAtiva} motivoBloqueio={MOTIVO_SIMULACAO_CRIAR} />
      </td>
      <td className="py-1.5 pr-2 align-top">
        {temPino ? (
          <select
            aria-label="Pino da nova variável"
            value={endereco}
            onChange={(evento) => setEndereco(evento.target.value)}
            disabled={semPinoLivre || simulacaoAtiva}
            title={simulacaoAtiva ? MOTIVO_SIMULACAO_CRIAR : undefined}
            aria-describedby={semPinoLivre ? idMotivoSemPino : undefined}
            className="w-full min-w-0 rounded border border-ide-borda bg-ide-painel p-1 font-mono text-xs text-ide-texto disabled:opacity-50"
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
        ) : (
          <p className="text-[11px] text-ide-suave">Memória: variável sem pino físico, usada na lógica.</p>
        )}
        {semPinoLivre && (
          <p id={idMotivoSemPino} className="mt-0.5 text-[11px] text-ide-perigo">
            Nenhum pino de {ROTULO_CLASSE_PINO[classe as 'entrada' | 'saida']} livre para declarar.
          </p>
        )}
      </td>
      <td className="py-1.5 pr-4 align-top text-right">
        <button
          type="button"
          onClick={submeter}
          disabled={desabilitado}
          title={simulacaoAtiva ? MOTIVO_SIMULACAO_CRIAR : undefined}
          className="inline-flex items-center gap-1 rounded bg-ide-destaque px-2 py-1 text-xs font-medium text-ide-destaque-texto hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus aria-hidden="true" size={12} />
          Adicionar
        </button>
      </td>
    </tr>
  )
}

/** Uma das duas tabelas do mapa de pinos (Entradas ou Saídas): uma linha por
 * endereço localizado, com o nome da variável que o usa ou "livre". */
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
    <div className="min-w-0 flex-1">
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

/** Rodapé recolhível: duas tabelas, Entradas e Saídas, lado a lado a partir de
 * telas médias (`md:flex-row`) — em telas estreitas continuam empilhadas. */
function MapaDePinos({ variaveis }: { variaveis: Variavel[] }) {
  return (
    <details className="border-t border-ide-borda px-4 py-3">
      <summary className="cursor-pointer select-none text-xs font-medium text-ide-suave">Mapa de pinos ESP32</summary>
      <div className="mt-2 flex flex-col gap-4 md:flex-row md:gap-6">
        <TabelaMapa titulo="Entradas" enderecos={ENTRADAS_LOCALIZADAS} variaveis={variaveis} />
        <TabelaMapa titulo="Saídas" enderecos={SAIDAS_LOCALIZADAS} variaveis={variaveis} />
      </div>
    </details>
  )
}

export default function TabelaVariaveis({
  variaveis,
  valores,
  aoAcionar,
  ciclo,
  enderecosComandadosPelaPlanta,
  motivoEntradaPlanta,
  aoDeclarar,
  aoAtualizar,
  aoRemover,
  simulacaoAtiva,
}: TabelaVariaveisProps) {
  const [filtro, setFiltro] = useState<ClasseFiltro>('todas')

  const visiveis = filtro === 'todas' ? variaveis : variaveis.filter((v) => classeDaVariavel(v) === filtro)

  return (
    <section aria-label="Variáveis" className="flex h-full flex-col overflow-hidden bg-ide-painel text-ide-texto">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-ide-borda px-4 py-3">
        <h2 className="text-sm font-semibold">Variáveis</h2>

        <div role="tablist" aria-label="Filtrar variáveis por classe" className="flex gap-1">
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

        <span className="ml-auto text-xs text-ide-suave">
          {ciclo !== undefined && <span className="mr-2 font-mono">Ciclo {ciclo}</span>}
          {variaveis.length} declarada{variaveis.length === 1 ? '' : 's'}
        </span>
      </header>

      {/* Área rolável única: a tabela inteira (cabeçalho de colunas incluso) e
       * o mapa de pinos ficam no fluxo normal aqui dentro, então a área rola
       * por inteiro quando a lista cresce. Só o cabeçalho "Variáveis" e as
       * abas de filtro acima ficam fixos, fora do scroll.
       *
       * `overflow-x-auto` + `min-w` na tabela (achado na verificação em
       * Chromium real, painel lateral estreito de 18–40rem, D-13): as seis
       * colunas não cabem espremidas em ~288–320px sem esconder o pino
       * (`GPIO n · %IX0.n`) — em vez de espremer até ficar ilegível, a
       * tabela mantém uma largura mínima legível e a área rola na horizontal
       * quando o painel é mais estreito que isso. */}
      <div className="min-h-0 flex-1 overflow-auto">
        <table aria-label="Variáveis declaradas" className="w-full min-w-[600px] table-fixed border-collapse text-sm">
          <colgroup>
            <col className="w-[24%]" />
            <col className="w-[8%]" />
            <col className="w-[14%]" />
            <col className="w-[26%]" />
            <col className="w-[14%]" />
            <col className="w-[14%]" />
          </colgroup>
          <thead>
            <tr className="border-b border-ide-borda text-left text-xs font-medium text-ide-suave">
              <th scope="col" className="px-4 py-2 font-medium">
                Nome
              </th>
              <th scope="col" className="py-2 pr-2 font-medium">
                Valor
              </th>
              <th scope="col" className="py-2 pr-2 font-medium">
                Tipo
              </th>
              <th scope="col" className="py-2 pr-2 font-medium">
                Uso
              </th>
              <th scope="col" className="py-2 pr-2 font-medium">
                Pino
              </th>
              <th scope="col" className="py-2 pr-4 font-medium">
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {visiveis.map((variavel, indice) => (
              <LinhaVariavel
                key={variavel.nome}
                variavel={variavel}
                variaveis={variaveis}
                valor={valores?.[variavel.nome]}
                aoAcionar={aoAcionar}
                bloqueadaPelaPlanta={
                  variavel.endereco !== undefined &&
                  enderecosComandadosPelaPlanta !== undefined &&
                  enderecosComandadosPelaPlanta.includes(variavel.endereco)
                }
                motivoBloqueioPlanta={motivoEntradaPlanta}
                zebra={indice % 2 === 1}
                aoAtualizar={aoAtualizar}
                aoRemover={aoRemover}
                simulacaoAtiva={simulacaoAtiva}
              />
            ))}

            {visiveis.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-3 text-center text-xs text-ide-suave">
                  Nenhuma variável{filtro === 'todas' ? ' declarada' : ' nesta categoria'}. Adicione abaixo.
                </td>
              </tr>
            )}

            <LinhaAdicionar variaveis={variaveis} aoDeclarar={aoDeclarar} simulacaoAtiva={simulacaoAtiva} />
          </tbody>
        </table>

        <MapaDePinos variaveis={variaveis} />
      </div>
    </section>
  )
}
