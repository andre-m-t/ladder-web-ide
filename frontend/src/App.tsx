import { useEffect, useMemo, useRef, useState } from 'react'

import AreaEditor, { type FocoLadder } from './components/ide/AreaEditor'
import BarraSimulacao from './components/ide/BarraSimulacao'
import BarraSuperior from './components/ide/BarraSuperior'
import type { OpcaoDownload } from './components/ide/MenuDownload'
import ModalConfirmarDescarte from './components/ide/ModalConfirmarDescarte'
import ModalNovoProjeto from './components/ide/ModalNovoProjeto'
import ModalPortaSerial from './components/ide/ModalPortaSerial'
import PainelInferior from './components/ide/PainelInferior'
import PainelInferiorConteudo, { type AbaInferior } from './components/ide/PainelInferiorConteudo'
import PainelLateral from './components/ide/PainelLateral'
import Toasts from './components/ide/Toasts'
import ModalAmbiente from './components/ambientes/ModalAmbiente'
import PainelAmbiente from './components/ambientes/PainelAmbiente'
import PainelVariaveis from './components/ladder/PainelVariaveis'
import { AMBIENTE_PADRAO_ID, ambientePorId } from './ambientes/catalogo'
import type { PontoAmbiente } from './ambientes/contrato'
import { executarCicloComAmbiente } from './ambientes/integracao'
import { AMBIENTE_PORTAO, criarEstadoPortao, type EstadoPortao } from './ambientes/portao'
import { declararVariaveisDoContrato, saidasPorEndereco } from './ambientes/vinculo'
import { declararVariavel } from './ladder/edicao'
import type { Diagrama } from './ladder/modelo'
import { exportarPlcopen } from './ladder/plcopen'
import { degrauDaLinha, serializar, type TrechoDegrau } from './ladder/serializador'
import {
  acionarEntrada,
  criarEstado,
  reiniciar,
  INTERVALO_TEMPO_REAL_MS,
  type EstadoSimulacao,
} from './ladder/simulacao'
import { validarDiagrama, type Problema } from './ladder/validacao'
import {
  compilarPacote,
  ErroCompilacao,
  ErroHttpCompilacao,
  ErroRedeCompilacao,
  fetchHealth,
  type Diagnostico,
  type Pacote,
  type ToolInfo,
} from './lib/api'
import { registrar, type EntradaConsole } from './lib/console'
import { baixarTexto, conteudoProjetoJson, nomeDeArquivo } from './lib/download'
import { ErroGravacao, gravar, webSerialDisponivel, type PortaLike } from './lib/gravador'
import { aplicarTema, temaInicial, type Tema } from './lib/tema'
import { adicionarToast, removerToast, type Toast } from './lib/toasts'
import {
  carregarProjeto,
  novoProjeto,
  projetoTemConteudo,
  salvarProjeto,
  TITULO_PADRAO,
  type Linguagem,
  type Projeto,
  type ResultadoCargaProjeto,
} from './projeto/projeto'
import {
  criarHistorico,
  desfazer,
  podeDesfazer,
  podeRefazer,
  refazer,
  registrar as registrarHistorico,
  type Historico,
} from './projeto/historico'

type ErroDeCompilacao = ErroCompilacao | ErroHttpCompilacao | ErroRedeCompilacao

type EstadoCompilacao =
  | { fase: 'ocioso' }
  | { fase: 'compilando' }
  | { fase: 'sucesso'; pacote: Pacote }
  | { fase: 'erro'; erro: ErroDeCompilacao }

type EstadoGravacao =
  | { fase: 'ocioso' }
  | { fase: 'gravando'; progresso: number }
  | { fase: 'sucesso' }
  | { fase: 'erro'; erro: ErroGravacao }

/** Estado do fluxo "Novo projeto" (tarefa #26): `confirmarDescarte` só
 * aparece quando o projeto atual já tem conteúdo (`projetoTemConteudo`);
 * `novoProjeto` é o modal de título/linguagem em si. Cancelar em qualquer um
 * dos dois volta direto para `'nenhum'`, sem tocar no projeto. */
type EstadoModalNovoProjeto = 'nenhum' | 'confirmarDescarte' | 'novoProjeto'

// --- Preferências de interface (localStorage) -------------------------------
// Layout do painel de variáveis (aberto/largura) e do painel inferior
// (aberto/altura). A aba ativa dentro do painel inferior (Problemas/Console,
// desde a tarefa #27) não persiste: nasce de novo a cada carga, conforme a
// regra da tarefa #25. O tema tem seu próprio armazenamento em
// `lib/tema.ts`. Leitura e escrita em try/catch: sem `localStorage`
// disponível, a IDE usa os padrões abaixo sem quebrar.

const CHAVE_PAINEL_VARIAVEIS_ABERTO = 'ladderflow.painelAberto'
const CHAVE_PAINEL_VARIAVEIS_LARGURA = 'ladderflow.painelLargura'
const CHAVE_CONSOLE_ABERTO = 'ladderflow.consoleAberto'
const CHAVE_CONSOLE_ALTURA = 'ladderflow.consoleAltura'

const PAINEL_VARIAVEIS_LARGURA_PADRAO = 320
const PAINEL_VARIAVEIS_LARGURA_MIN = 288 // 18rem
const LARGURA_MIN_EDITOR = 320
const PAINEL_AMBIENTE_LARGURA_MIN = 360
const CONSOLE_ALTURA_PADRAO = 192
const CONSOLE_ALTURA_MIN = 96 // 6rem

// --- Simulação (spec 004, tarefa #11, D-8/D-9) -------------------------------
// `App` é dona do relógio: um laço em `requestAnimationFrame` (efeito mais
// abaixo) calcula quantos ciclos cabem no tempo decorrido desde o último
// quadro e executa todos em sequência antes de um único redesenho — nunca um
// `setState` por ciclo (RF-11). O estado da simulação (`EstadoModoSimulacao`)
// nunca é persistido em `localStorage`: é assim, de graça, que a spec cumpre
// RF-17 (volátil) — o efeito de gravação de preferências abaixo nunca toca
// `simulacao`.

interface MarchaSimulacao {
  id: string
  rotulo: string
  intervaloMs: number
}

/** Tempo real (20 ms/ciclo, o `T#20ms` do firmware) como padrão, e uma marcha
 * lenta (RF-11: "ao menos uma") — 500 ms é devagar o bastante para acompanhar
 * um degrau combinacional a olho nu, sem virar um segundo controle de tempo
 * arbitrário (decisão registrada no relatório: a spec só pede "ao menos
 * uma"). */
const MARCHAS_SIMULACAO: MarchaSimulacao[] = [
  { id: 'tempo-real', rotulo: `Tempo real (${INTERVALO_TEMPO_REAL_MS} ms/ciclo)`, intervaloMs: INTERVALO_TEMPO_REAL_MS },
  { id: 'lenta', rotulo: 'Marcha lenta (500 ms/ciclo)', intervaloMs: 500 },
]
const MARCHA_SIMULACAO_PADRAO = MARCHAS_SIMULACAO[0].id

/** Teto de ciclos executados num único quadro (D-8): protege a aba de tentar
 * "recuperar" o atraso todo de uma vez quando a janela volta de segundo
 * plano (o navegador pausa `requestAnimationFrame`, então o próximo quadro
 * pode chegar com `dt` de minutos). Acima do teto, o relógio de referência é
 * ressincronizado com o presente em vez de perseguir o atraso em rajadas nos
 * quadros seguintes — a simulação "pula" o tempo em segundo plano em vez de
 * tentar reencenar cada ciclo perdido. Valor folgado para o alvo de 50
 * degraus a 20 ms/ciclo da CA-11 (bem menos que isso por quadro em uso
 * normal — 1 ciclo a 60 Hz em tempo real).
 */
const MAX_CICLOS_POR_QUADRO = 10

const MOTIVO_CRIACAO_EM_SIMULACAO = 'Saia da simulação para criar variáveis'

function intervaloDaMarcha(marchaId: string): number {
  return MARCHAS_SIMULACAO.find((m) => m.id === marchaId)?.intervaloMs ?? INTERVALO_TEMPO_REAL_MS
}

/** Estado do modo de simulação (D-9): `ativo: false` é o modo de edição de
 * sempre. Com `ativo: true`, `rodando` é Executar (true) ou Pausar (false),
 * `marchaId` escolhe entre `MARCHAS_SIMULACAO` e `estado` é o
 * `EstadoSimulacao` do núcleo (`ladder/simulacao.ts`), avançado por
 * `executarCiclo`. Nunca gravado em `localStorage` (RF-17). */
type EstadoModoSimulacao =
  | { ativo: false }
  | { ativo: true; rodando: boolean; marchaId: string; estado: EstadoSimulacao }

function lerPreferencia<T>(chave: string, converter: (bruto: string) => T | null, padrao: T): T {
  try {
    const bruto = window.localStorage.getItem(chave)
    if (bruto === null) return padrao
    const valor = converter(bruto)
    return valor ?? padrao
  } catch {
    return padrao
  }
}

function gravarPreferencia(chave: string, valor: string): void {
  try {
    window.localStorage.setItem(chave, valor)
  } catch {
    // sem localStorage: a preferência de interface não persiste, sem quebrar a IDE.
  }
}

function lerBooleano(chave: string, padrao: boolean): boolean {
  return lerPreferencia(chave, (bruto) => (bruto === 'true' ? true : bruto === 'false' ? false : null), padrao)
}

function lerNumero(chave: string, padrao: number): number {
  return lerPreferencia(
    chave,
    (bruto) => {
      const numero = Number(bruto)
      return Number.isFinite(numero) ? numero : null
    },
    padrao,
  )
}

/** Altura máxima do console: 60% da altura da janela (plano D-13). */
function alturaMaximaConsole(): number {
  if (typeof window === 'undefined') return 480
  return Math.round(window.innerHeight * 0.6)
}

/** Largura máxima do painel lateral: o editor central mantém ao menos
 * `LARGURA_MIN_EDITOR` px (spec 002, revisão 2026-09-23). */
function larguraMaximaPainel(): number {
  if (typeof window === 'undefined') return 640
  return Math.max(PAINEL_VARIAVEIS_LARGURA_MIN, window.innerWidth - LARGURA_MIN_EDITOR)
}

/** Carga inicial do projeto (tarefa #26; antes, tarefa #12/#25 para o
 * diagrama solto): `carregarProjeto` já nunca lança, mas o próprio acesso à
 * propriedade `window.localStorage` pode lançar em alguns navegadores (modo
 * privado) antes mesmo de chegar a `getItem` — protegido aqui do mesmo jeito
 * que a carga inicial do diagrama fazia. */
function carregarProjetoInicial(): ResultadoCargaProjeto {
  try {
    return carregarProjeto(window.localStorage)
  } catch {
    return {
      projeto: novoProjeto(TITULO_PADRAO, 'ld'),
      aviso: 'projeto salvo descartado: não foi possível acessar o armazenamento local',
      veioDoArmazenamento: false,
    }
  }
}

/** Aba inicial do painel inferior (tarefa #25, mantida na #26): "console" é o
 * padrão — só abre em "problemas" quando o projeto veio mesmo do
 * armazenamento (não caiu no vazio), é um projeto Ladder (ST não tem
 * diagrama) **e** já nasce com pelo menos um erro (`validarDiagrama`). Um
 * aviso sozinho, ou um projeto descartado com aviso, nunca muda a aba. */
function abaInferiorInicial(projeto: Projeto, veioDoArmazenamento: boolean): AbaInferior {
  if (!veioDoArmazenamento) return 'console'
  if (projeto.linguagem !== 'ld') return 'console'
  const temErro = validarDiagrama(projeto.diagrama).some((problema) => problema.severidade === 'erro')
  return temErro ? 'problemas' : 'console'
}

/** "1 problema" / "N problemas" (plural correto) — D-6, regra 1. */
function pluralizarProblema(quantidade: number): string {
  return quantidade === 1 ? 'problema' : 'problemas'
}

/** Estreita `Projeto` para o `Diagrama` de um projeto Ladder, ou `null` em
 * projeto ST (spec 004, tarefa #11) — `Projeto` é uma união discriminada
 * (`ladder/projeto.ts`) e `projetoRef.current`/o parâmetro `projeto` não
 * narroweiam sozinhos fora de um `if` local; usado pelos manipuladores da
 * simulação, que só são alcançáveis com `motivoSimulacaoIndisponivel`
 * ausente (ou seja, já em projeto Ladder) — o `null` aqui é defensivo, não
 * um caminho esperado em uso normal. */
function diagramaLd(p: Projeto): Diagrama | null {
  return p.linguagem === 'ld' ? p.diagrama : null
}

/**
 * Diagnósticos do compilador (`Diagnostico.line`), levados de volta ao degrau
 * que os gerou (D-8/Q-3): usa `degrauDaLinha(mapaLinhas, line)` e, quando o
 * degrau existe no diagrama atual, monta a mensagem com o número 1-based do
 * degrau; quando a linha cai fora de qualquer trecho (declarações, cabeçalho,
 * esqueleto da `CONFIGURATION`), a mensagem cita só a linha. Diagnósticos sem
 * `line` (`null`) não geram `Problema` — não há como relacioná-los a um
 * degrau, e a mensagem do envelope já foi para o Console em `aoCompilar`.
 */
function problemasDeDiagnosticos(diagnosticos: Diagnostico[], mapaLinhas: TrechoDegrau[], diagrama: Diagrama): Problema[] {
  const problemas: Problema[] = []
  for (const diagnostico of diagnosticos) {
    if (diagnostico.line === null) continue
    const rungId = degrauDaLinha(mapaLinhas, diagnostico.line) ?? ''
    const indiceDegrau = rungId === '' ? -1 : diagrama.rungs.findIndex((rung) => rung.id === rungId)
    const mensagem =
      indiceDegrau >= 0
        ? `Erro do compilador no degrau ${indiceDegrau + 1} (linha ${diagnostico.line}): ${diagnostico.message}`
        : `Erro do compilador na linha ${diagnostico.line}: ${diagnostico.message}`
    problemas.push({ codigo: 'erro_compilacao', severidade: 'erro', rungId, elementoId: null, mensagem })
  }
  return problemas
}

/**
 * Shell de IDE do LadderFlow (spec 002, tarefas #23–#26; painel de variáveis
 * devolvido ao lateral na revisão da tarefa #26 — o autor testou a sub-aba de
 * largura inteira e pediu de volta o painel lateral): tela inteira com barra
 * superior (título/linguagem do projeto, compilar/gravar, alternadores),
 * editor central com o painel de variáveis ao lado (só em projeto Ladder,
 * recolhível e redimensionável) e console de eventos do cliente recolhível e
 * redimensionável embaixo.
 *
 * A partir da tarefa #26 a IDE trabalha com um **projeto** de linguagem única
 * (`projeto/projeto.ts`) em vez de manter Ladder e ST lado a lado nas mesmas
 * abas: o autor escolhe a linguagem em "Novo projeto" e todo o resto —
 * diagrama ou fonte, painel de variáveis, compilar/gravar — decorre dessa
 * escolha.
 *
 * A saúde do servidor de compilação (`/health`) não aparece na barra: uma
 * linha por ferramenta (MATIEC, toolchain ESP32) vai para o console na carga
 * inicial. O servidor de compilação continua síncrono (spec 001, Q-6): o
 * console mostra os eventos que o próprio cliente observa (início/fim,
 * progresso), não um streaming da saída do `iec2c`/`idf.py`.
 */
export default function App() {
  const [tema, setTema] = useState<Tema>(() => temaInicial())

  // Carga inicial do projeto: uma única leitura do `localStorage` no mount,
  // guardada aqui para o efeito de log abaixo e para a aba inicial do painel
  // inferior reaproveitarem o mesmo resultado (projeto, aviso e "veio do
  // armazenamento" nascem juntos, de uma só leitura).
  const [cargaInicial] = useState<ResultadoCargaProjeto>(() => carregarProjetoInicial())
  const [projeto, setProjeto] = useState<Projeto>(() => cargaInicial.projeto)
  const [historico, setHistorico] = useState<Historico<Projeto>>(() => criarHistorico(cargaInicial.projeto))
  const [abaInferior, setAbaInferior] = useState<AbaInferior>(() =>
    abaInferiorInicial(cargaInicial.projeto, cargaInicial.veioDoArmazenamento),
  )
  const [foco, setFoco] = useState<FocoLadder | null>(null)

  const [painelVariaveisAberto, setPainelVariaveisAberto] = useState(() =>
    lerBooleano(CHAVE_PAINEL_VARIAVEIS_ABERTO, true),
  )
  const [larguraMaxPainel, setLarguraMaxPainel] = useState(() => larguraMaximaPainel())
  const [painelVariaveisLargura, setPainelVariaveisLargura] = useState(() =>
    Math.min(
      larguraMaximaPainel(),
      Math.max(PAINEL_VARIAVEIS_LARGURA_MIN, lerNumero(CHAVE_PAINEL_VARIAVEIS_LARGURA, PAINEL_VARIAVEIS_LARGURA_PADRAO)),
    ),
  )
  const [consoleAberto, setConsoleAberto] = useState(() => lerBooleano(CHAVE_CONSOLE_ABERTO, true))
  const [consoleAltura, setConsoleAltura] = useState(() =>
    Math.max(CONSOLE_ALTURA_MIN, lerNumero(CHAVE_CONSOLE_ALTURA, CONSOLE_ALTURA_PADRAO)),
  )

  const [compilacao, setCompilacao] = useState<EstadoCompilacao>({ fase: 'ocioso' })
  const [gravacao, setGravacao] = useState<EstadoGravacao>({ fase: 'ocioso' })
  const [entradasConsole, setEntradasConsole] = useState<EntradaConsole[]>([])
  const [toasts, setToasts] = useState<Toast[]>([])
  const [modalNovoProjeto, setModalNovoProjeto] = useState<EstadoModalNovoProjeto>('nenhum')

  /** Modo de simulação (spec 004, tarefa #11, D-9) — ver `EstadoModoSimulacao`
   * acima. Nunca entra no efeito de `salvarProjeto` (`projeto` é a única
   * coisa persistida) nem em nenhuma das chaves de `localStorage` deste
   * arquivo — é assim que RF-17 (volátil) é cumprido, por omissão. */
  const [simulacao, setSimulacao] = useState<EstadoModoSimulacao>({ ativo: false })

  /** Ambiente de simulação (spec 005) — volátil, sem localStorage. */
  const [painelAmbienteAberto, setPainelAmbienteAberto] = useState(false)
  const [modalAmbienteAberto, setModalAmbienteAberto] = useState(false)
  const [modalPortaSerialAberto, setModalPortaSerialAberto] = useState(false)
  const [ambienteId, setAmbienteId] = useState(AMBIENTE_PADRAO_ID)
  const [plantaPortao, setPlantaPortao] = useState<EstadoPortao>(() => criarEstadoPortao())

  const problemasValidacao = useMemo(() => (projeto.linguagem === 'ld' ? validarDiagrama(projeto.diagrama) : []), [projeto])

  /** Diagnósticos do compilador já traduzidos para `Problema` (D-8/Q-3), só
   * em projeto Ladder. Limpos a cada mudança de projeto (efeito abaixo) e no
   * início de cada nova tentativa de compilar (`aoCompilar`) — nunca ficam
   * "presos" de uma compilação anterior. */
  const [problemasCompilacao, setProblemasCompilacao] = useState<Problema[]>([])

  /** Lista completa passada ao editor e ao painel inferior (contador da aba
   * "Problemas" incluído): validação estrutural + diagnósticos de compilação
   * traduzidos por degrau. O portão de compilação (D-6, regra 1) usa só
   * `problemasValidacao` — ver `motivoIndisponivel`. */
  const problemas = useMemo(
    () => [...problemasValidacao, ...problemasCompilacao],
    [problemasValidacao, problemasCompilacao],
  )

  /** Serialização do diagrama (spec 003, D-6/D-10; D-12 na revisão da tarefa
   * #11), só em projeto Ladder — `undefined` em projeto ST. Além de
   * alimentar o portão de Compilar/Gravar, é a fonte da opção "Structured
   * Text (.st)" do menu Baixar quando o projeto é Ladder (`opcoesDownload`).
   * Recalculada a cada mudança do projeto, junto com `problemasValidacao`. */
  const stGerado = useMemo(
    () => (projeto.linguagem === 'ld' ? serializar(projeto.diagrama) : undefined),
    [projeto],
  )

  // D-8: uma nova versão do projeto invalida os diagnósticos de compilação
  // anteriores — eles apontavam para um `mapaLinhas` de uma serialização que
  // já não é a atual.
  useEffect(() => {
    setProblemasCompilacao([])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projeto])

  const cargaInicialRegistrada = useRef(false)
  /** Falha de `salvarProjeto` já registrada no console: evita inundar o
   * console a cada tecla enquanto o armazenamento continuar recusando —
   * registra de novo só quando a gravação volta a falhar depois de um
   * sucesso (herdado da tarefa #12). */
  const falhaSalvarRegistrada = useRef(false)
  const focoToken = useRef(0)

  /** Espelham o `projeto`/`simulacao` mais recentes para leitura síncrona
   * fora de `render` — o laço de `requestAnimationFrame` (efeito mais
   * abaixo) e os manipuladores de Passo/Reiniciar/acionar entrada precisam
   * do valor atual sem esperar o próximo `render` (mesmo padrão de
   * `diagramaRef`/`aoMudarRef` em `EditorLadder.tsx`). */
  const projetoRef = useRef(projeto)
  const simulacaoRef = useRef(simulacao)
  const plantaPortaoRef = useRef(plantaPortao)
  const painelAmbienteAbertoRef = useRef(painelAmbienteAberto)
  const ambienteIdRef = useRef(ambienteId)
  useEffect(() => {
    projetoRef.current = projeto
  }, [projeto])
  useEffect(() => {
    simulacaoRef.current = simulacao
  }, [simulacao])
  useEffect(() => {
    plantaPortaoRef.current = plantaPortao
  }, [plantaPortao])
  useEffect(() => {
    painelAmbienteAbertoRef.current = painelAmbienteAberto
  }, [painelAmbienteAberto])
  useEffect(() => {
    ambienteIdRef.current = ambienteId
  }, [ambienteId])

  function log(nivel: EntradaConsole['nivel'], mensagem: string) {
    setEntradasConsole((atual) => registrar(atual, nivel, mensagem))
  }

  /** Recusa de uma jogada do editor Ladder ou do painel de variáveis (tarefas
   * #25/#26, revisado na #27, `aoRecusar`): aparece como um toast (nível
   * `aviso`), no momento em que acontece — a aba Mensagens saiu do painel
   * inferior (D-18). Nada disto vai ao Console, que continua reservado aos
   * eventos que o próprio cliente observa (compilação, gravação, saúde do
   * servidor). */
  function recusar(motivo: string) {
    setToasts((atual) => adicionarToast(atual, 'aviso', motivo))
  }

  function fecharToast(id: number) {
    setToasts((atual) => removerToast(atual, id))
  }

  function registrarFalhaPlanta(mensagem: string) {
    setToasts((atual) => adicionarToast(atual, 'erro', mensagem))
    log('erro', mensagem)
    setSimulacao((atual) => (atual.ativo ? { ...atual, rodando: false } : atual))
  }

  const motivoAmbienteIndisponivel = projeto.linguagem !== 'ld' ? 'Ambiente disponível apenas em projeto Ladder' : undefined
  const motivoPainelVariaveisIndisponivel = painelAmbienteAberto ? 'Feche o ambiente para ver as variáveis' : undefined

  const ambienteAtivo = painelAmbienteAberto && ambienteId === AMBIENTE_PORTAO.id
  const enderecosComandadosPelaPlanta = ambienteAtivo ? AMBIENTE_PORTAO.enderecosEntradaComandados() : undefined
  const motivoEntradaPlanta = ambienteAtivo ? 'Comandada pelo ambiente de simulação' : undefined
  const pontosAmbienteAberto = painelAmbienteAberto ? ambientePorId(ambienteId)?.pontos : undefined

  const saidasAmbienteMapa = useMemo(() => {
    const diagrama = diagramaLd(projeto)
    if (!diagrama || !simulacao.ativo) return {}
    return saidasPorEndereco(diagrama, simulacao.estado.variaveis)
  }, [projeto, simulacao])

  useEffect(() => {
    function aoRedimensionarJanela() {
      const max = larguraMaximaPainel()
      setLarguraMaxPainel(max)
      setPainelVariaveisLargura((atual) => Math.min(max, atual))
    }
    window.addEventListener('resize', aoRedimensionarJanela)
    return () => window.removeEventListener('resize', aoRedimensionarJanela)
  }, [])

  function aoMudarProjeto(novo: Projeto) {
    setHistorico((h) => registrarHistorico(h, novo))
    setProjeto(novo)
  }

  function aoDesfazerProjeto() {
    if (simulacao.ativo) return
    setHistorico((h) => {
      const prox = desfazer(h)
      if (!prox) return h
      setProjeto(prox.presente)
      return prox
    })
  }

  function aoRefazerProjeto() {
    if (simulacao.ativo) return
    setHistorico((h) => {
      const prox = refazer(h)
      if (!prox) return h
      setProjeto(prox.presente)
      return prox
    })
  }

  const historicoRef = useRef(historico)
  const simulacaoAtivaRef = useRef(simulacao.ativo)
  historicoRef.current = historico
  simulacaoAtivaRef.current = simulacao.ativo

  useEffect(() => {
    function aoTeclarDesfazer(evento: KeyboardEvent) {
      if (simulacaoAtivaRef.current) return
      if (!(evento.ctrlKey || evento.metaKey)) return
      const alvo = evento.target
      if (alvo instanceof HTMLElement) {
        const tag = alvo.tagName
        if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return
        if (alvo.closest('#editor-st')) return
      }
      if (evento.key === 'z' && !evento.shiftKey) {
        evento.preventDefault()
        const prox = desfazer(historicoRef.current)
        if (!prox) return
        historicoRef.current = prox
        setHistorico(prox)
        setProjeto(prox.presente)
        return
      }
      if (evento.key === 'y' || (evento.key === 'z' && evento.shiftKey)) {
        evento.preventDefault()
        const prox = refazer(historicoRef.current)
        if (!prox) return
        historicoRef.current = prox
        setHistorico(prox)
        setProjeto(prox.presente)
      }
    }
    window.addEventListener('keydown', aoTeclarDesfazer)
    return () => window.removeEventListener('keydown', aoTeclarDesfazer)
  }, [])

  useEffect(() => {
    if (cargaInicialRegistrada.current) return
    cargaInicialRegistrada.current = true
    document.title = 'LadderFlow'
    log('info', 'LadderFlow iniciado.')
    if (cargaInicial.aviso) log('aviso', cargaInicial.aviso)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Salva o projeto a cada mudança (herdado da tarefa #12/#26, D-5). Roda
  // também no mount (reescreve o que acabou de ser carregado — inofensivo)
  // para cobrir o caso comum: primeiro projeto nunca salvo ainda.
  // `window.localStorage` pode lançar ao ser acessado (não só nos métodos) em
  // alguns navegadores; protegido do mesmo jeito que a carga inicial.
  useEffect(() => {
    let erro: string | null
    try {
      erro = salvarProjeto(window.localStorage, projeto)
    } catch {
      erro = 'não foi possível salvar o projeto no armazenamento local'
    }
    if (erro) {
      if (!falhaSalvarRegistrada.current) {
        falhaSalvarRegistrada.current = true
        log('aviso', erro)
      }
    } else {
      falhaSalvarRegistrada.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projeto])

  useEffect(() => {
    let cancelado = false

    fetchHealth()
      .then((health) => {
        if (cancelado) return
        logLinhaFerramenta('MATIEC (iec2c)', health.iec2c)
        logLinhaFerramenta('Toolchain ESP32 (ESP-IDF)', health.esp_idf)
      })
      .catch(() => {
        if (cancelado) return
        log('erro', 'Servidor de compilação indisponível.')
      })

    return () => {
      cancelado = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** Uma linha por ferramenta ao abrir (plano D-14, item 3): disponível com a
   * versão relatada por `/health`, ou indisponível com o caminho esperado. */
  function logLinhaFerramenta(nome: string, info: ToolInfo) {
    if (info.available) {
      log('sucesso', `${nome}: disponível — ${info.version ?? 'versão desconhecida'}`)
    } else {
      log('erro', `${nome}: indisponível — não encontrado em ${info.path}`)
    }
  }

  useEffect(() => gravarPreferencia(CHAVE_PAINEL_VARIAVEIS_ABERTO, String(painelVariaveisAberto)), [painelVariaveisAberto])
  useEffect(
    () => gravarPreferencia(CHAVE_PAINEL_VARIAVEIS_LARGURA, String(painelVariaveisLargura)),
    [painelVariaveisLargura],
  )
  useEffect(() => gravarPreferencia(CHAVE_CONSOLE_ABERTO, String(consoleAberto)), [consoleAberto])
  useEffect(() => gravarPreferencia(CHAVE_CONSOLE_ALTURA, String(consoleAltura)), [consoleAltura])

  const compilando = compilacao.fase === 'compilando'
  const gravando = gravacao.fase === 'gravando'
  const temPacoteValido = compilacao.fase === 'sucesso'
  const webSerialOk = webSerialDisponivel()
  const podeGravar = temPacoteValido && webSerialOk && !gravando

  /**
   * Portão de Compilar/Gravar em projeto Ladder (spec 003, D-6; spec 004,
   * RF-15 acrescenta a regra 0), na primeira regra que valer:
   *   0. a simulação está ativa (RF-15/CA-8) — "Indisponível durante a
   *      simulação…", checado antes de tudo: a simulação nem olha para
   *      `stGerado`/validação, que continuam sendo os do diagrama tal como
   *      estava ao entrar no modo (o editor está congelado, então não mudam);
   *   1. há problema de severidade "erro" na **validação** (nunca nos
   *      diagnósticos de compilação — senão, depois de uma falha, Compilar
   *      ficaria travado até o autor editar o diagrama de novo, mesmo que o
   *      motivo da falha já tenha ido para a aba Problemas);
   *   2. a serialização devolve "vazio" (D-7/Q-6) — "Nada a compilar…";
   *   3. a serialização recusa (D-5) — o motivo dela;
   *   4. nenhuma das anteriores: `undefined`, Compilar habilitado.
   * Avisos de validação nunca bloqueiam. Em projeto ST, continua `undefined`
   * fora de simulação (compilar sempre disponível, como antes desta spec) —
   * simulação em si não é alcançável em projeto ST (RF-16), então a regra 0
   * nunca dispara ali na prática, mas fica pela mesma ordem de leitura.
   */
  const motivoIndisponivel: string | undefined = useMemo(() => {
    if (simulacao.ativo) {
      return 'Indisponível durante a simulação — saia da simulação para compilar ou gravar'
    }
    if (projeto.linguagem !== 'ld') return undefined

    const errosDeValidacao = problemasValidacao.filter((problema) => problema.severidade === 'erro')
    if (errosDeValidacao.length > 0) {
      return `${errosDeValidacao.length} ${pluralizarProblema(errosDeValidacao.length)} no diagrama — ver aba Problemas`
    }
    if (stGerado !== undefined && !stGerado.ok && stGerado.vazio) {
      return 'Nada a compilar: o diagrama não tem elementos'
    }
    if (stGerado !== undefined && !stGerado.ok) {
      return stGerado.motivo
    }
    return undefined
  }, [simulacao.ativo, projeto.linguagem, problemasValidacao, stGerado])

  /**
   * Portão de **entrada** na simulação (spec 004, RF-16, RF-18; mesmo espírito
   * de `motivoIndisponivel`, regra própria porque os critérios não coincidem:
   * simulação não olha para `stGerado` — RF-9, o simulador não fala a língua
   * do compilador):
   *   1. projeto ST (RF-16/Q-6) — simulação fora de escopo, motivo fixo;
   *   2. erro de `validarDiagrama` (RF-18/CA-12) — mesmo portão do Compilar,
   *      mesma mensagem; aviso nunca bloqueia;
   *   3. nenhuma das anteriores: `undefined`, botão "Simular" habilitado.
   * Só decide se dá para **entrar**; sair de uma simulação já ativa nunca é
   * bloqueado por este motivo (`BarraSuperior` trata isso à parte).
   */
  const motivoSimulacaoIndisponivel: string | undefined = useMemo(() => {
    if (projeto.linguagem !== 'ld') {
      return 'Simulação disponível apenas em projeto Ladder'
    }
    const errosDeValidacao = problemasValidacao.filter((problema) => problema.severidade === 'erro')
    if (errosDeValidacao.length > 0) {
      return `${errosDeValidacao.length} ${pluralizarProblema(errosDeValidacao.length)} no diagrama — ver aba Problemas`
    }
    return undefined
  }, [projeto.linguagem, problemasValidacao])

  /**
   * Opções do menu Baixar (spec 003, D-12/tarefa #11): em projeto Ladder,
   * o envelope do projeto em JSON e o texto Structured Text — este último
   * com o mesmo motivo de indisponibilidade do portão de Compilar/Gravar
   * (`motivoIndisponivel`, D-6), porque as duas coisas dependem da mesma
   * serialização válida. Em projeto ST, só a opção .st, sempre disponível
   * (a fonte já existe, editada à mão).
   */
  const opcoesDownload: OpcaoDownload[] = useMemo(() => {
    if (projeto.linguagem === 'st') {
      return [{ id: 'st', rotulo: 'Structured Text (.st)' }]
    }
    return [
      { id: 'ld', rotulo: 'Ladder (.json)' },
      { id: 'st', rotulo: 'Structured Text (.st)', desabilitadaMotivo: motivoIndisponivel },
      { id: 'plcopen', rotulo: 'PLCopen XML (.xml)', desabilitadaMotivo: motivoIndisponivel },
    ]
  }, [projeto.linguagem, motivoIndisponivel])

  /**
   * Dispara o download escolhido no menu Baixar (D-12): `.json` é sempre o
   * envelope do projeto atual (só existe a opção em projeto Ladder); `.st` é
   * `stGerado.st` em projeto Ladder (guardado por `motivoIndisponivel` —
   * defensivo aqui também, o mesmo espírito de `aoCompilar`) ou
   * `projeto.fonte` direto em projeto ST. Uma linha "Baixado …" vai ao
   * Console, no mesmo padrão informativo do resto da IDE.
   */
  function aoBaixar(id: OpcaoDownload['id']) {
    if (id === 'ld') {
      if (projeto.linguagem !== 'ld') return
      const nome = nomeDeArquivo(projeto.titulo, 'ladderflow.json')
      baixarTexto(nome, conteudoProjetoJson(projeto), 'application/json')
      log('info', `Baixado ${nome}.`)
      return
    }

    if (id === 'plcopen') {
      if (projeto.linguagem !== 'ld') return
      if (stGerado === undefined || !stGerado.ok) return
      const nome = nomeDeArquivo(projeto.titulo, 'xml')
      const xml = exportarPlcopen(projeto.diagrama, projeto.titulo)
      baixarTexto(nome, xml, 'application/xml')
      log('info', `Baixado ${nome}.`)
      return
    }

    let fonte: string
    if (projeto.linguagem === 'st') {
      fonte = projeto.fonte
    } else {
      if (stGerado === undefined || !stGerado.ok) return
      fonte = stGerado.st
    }
    const nome = nomeDeArquivo(projeto.titulo, 'st')
    baixarTexto(nome, fonte, 'text/plain;charset=utf-8')
    log('info', `Baixado ${nome}.`)
  }

  /**
   * Compila o projeto atual (D-10): a fonte vem da caixa de texto num
   * projeto ST, ou do texto que `serializar` já produziu (`stGerado.st`) num
   * projeto Ladder — o mesmo `compilarPacote`, o mesmo log e o mesmo estado
   * de compilação para as duas linguagens, sem caminho novo (RF-6). A guarda
   * de `stGerado` é só defensiva: com o portão de D-6 no lugar, `aoCompilar`
   * não deveria ser alcançável com a serialização recusada ou vazia.
   */
  async function aoCompilar() {
    let fonte: string
    if (projeto.linguagem === 'st') {
      fonte = projeto.fonte
    } else {
      if (stGerado === undefined || !stGerado.ok) return
      fonte = stGerado.st
    }

    setProblemasCompilacao([])
    setCompilacao({ fase: 'compilando' })
    setGravacao({ fase: 'ocioso' })
    log('info', 'Compilação iniciada.')
    const inicio = performance.now()

    try {
      const pacote = await compilarPacote(fonte)
      setCompilacao({ fase: 'sucesso', pacote })
      const decorrido = ((performance.now() - inicio) / 1000).toFixed(1)
      log('sucesso', `Compilação concluída em ${decorrido}s — chip ${pacote.chip}.`)
      for (const imagem of pacote.images) {
        const offsetHex = `0x${imagem.offset.toString(16)}`
        const tamanhoKb = (imagem.size / 1024).toFixed(1)
        log('info', `Imagem ${imagem.name}: offset ${offsetHex}, ${tamanhoKb} KB.`)
      }
    } catch (erro) {
      const decorrido = ((performance.now() - inicio) / 1000).toFixed(1)
      const erroTratado =
        erro instanceof ErroCompilacao || erro instanceof ErroHttpCompilacao || erro instanceof ErroRedeCompilacao
          ? erro
          : new ErroRedeCompilacao(erro instanceof Error ? erro.message : String(erro))
      setCompilacao({ fase: 'erro', erro: erroTratado })

      if (erroTratado instanceof ErroCompilacao) {
        const { envelope } = erroTratado
        log('erro', `Falha na compilação após ${decorrido}s — etapa ${envelope.stage} (${envelope.code}): ${envelope.message}`)
        for (const diagnostico of envelope.diagnostics) {
          log('erro', `${diagnostico.line ?? '?'}:${diagnostico.column ?? '?'} — ${diagnostico.message}`)
        }

        // D-8/Q-3: em projeto Ladder, cada diagnóstico com linha volta a ser
        // um problema do degrau que a gerou, somado à lista da aba Problemas.
        // Se algum deles apontar para um degrau real (rungId não vazio),
        // abre a aba Problemas — é o jeito de "ver o motivo" chegar até quem
        // acionou Compilar sem precisar procurar; um diagnóstico só de
        // declaração/cabeçalho (sem degrau) não abre nada por conta própria,
        // porque não há onde focar na tela além da mensagem já no Console.
        if (projeto.linguagem === 'ld' && stGerado !== undefined && stGerado.ok) {
          const novosProblemas = problemasDeDiagnosticos(envelope.diagnostics, stGerado.mapaLinhas, projeto.diagrama)
          setProblemasCompilacao(novosProblemas)
          if (novosProblemas.some((problema) => problema.rungId !== '')) {
            setAbaInferior('problemas')
          }
        }
      } else {
        log('erro', `Falha na compilação após ${decorrido}s: ${erroTratado.message}`)
      }
    }
  }

  function aoGravar() {
    if (compilacao.fase !== 'sucesso') return
    setModalPortaSerialAberto(true)
  }

  async function executarGravacao(porta: PortaLike) {
    if (compilacao.fase !== 'sucesso') return

    setGravacao({ fase: 'gravando', progresso: 0 })
    log('info', 'Gravação iniciada.')
    let ultimaDezena = -1

    try {
      await gravar(compilacao.pacote, {
        porta,
        onProgresso: (progresso) => {
          setGravacao({ fase: 'gravando', progresso })
          const dezena = Math.floor(progresso / 10)
          if (dezena > ultimaDezena) {
            ultimaDezena = dezena
            log('info', `Gravando… ${dezena * 10}%`)
          }
        },
      })
      setGravacao({ fase: 'sucesso' })
      log('sucesso', 'Firmware gravado com sucesso.')
    } catch (erro) {
      const erroTratado = erro instanceof ErroGravacao ? erro : new ErroGravacao('falha_gravacao', erro)
      setGravacao({ fase: 'erro', erro: erroTratado })
      log('erro', `Falha na gravação (${erroTratado.tipo}): ${erroTratado.message}`)
    }
  }

  function aoAlternarTema() {
    const novoTema: Tema = tema === 'escuro' ? 'claro' : 'escuro'
    aplicarTema(novoTema)
    setTema(novoTema)
  }

  // --- Simulação (spec 004, tarefa #11) --------------------------------------

  /** Entra em simulação (RF-15/D-9): bloqueado pelo mesmo motivo que
   * desabilita o botão "Simular" (`motivoSimulacaoIndisponivel` — RF-16/
   * RF-18), defensivo aqui também (o botão já fica desabilitado). O estado
   * nasce de `criarEstado`, sempre rodando (a marcha padrão é tempo real). */
  function aoEntrarSimulacao() {
    if (motivoSimulacaoIndisponivel) return
    const diagrama = diagramaLd(projeto)
    if (!diagrama) return
    setSimulacao({ ativo: true, rodando: true, marchaId: MARCHA_SIMULACAO_PADRAO, estado: criarEstado(diagrama) })
    log('info', 'Simulação iniciada.')
  }

  /** Sai da simulação (RF-15/RF-17): descarta o `EstadoSimulacao` — é assim
   * que "volátil" é cumprido, não há para onde ele iria (nunca esteve em
   * `localStorage`). Edição, Compilar e Gravar voltam juntos, porque todos
   * checam `simulacao.ativo`/`motivoIndisponivel`, não um estado próprio. */
  function aoSairSimulacao() {
    if (!simulacaoRef.current.ativo) return
    setSimulacao({ ativo: false })
    log('info', 'Simulação encerrada.')
  }

  function aoAlternarSimulacao() {
    if (simulacaoRef.current.ativo) aoSairSimulacao()
    else aoEntrarSimulacao()
  }

  function aoAlternarExecucaoSimulacao() {
    setSimulacao((atual) => (atual.ativo ? { ...atual, rodando: !atual.rodando } : atual))
  }

  /** Passo (CA-6): exatamente um ciclo, com a simulação rodando ou pausada —
   * não depende do laço de `requestAnimationFrame` abaixo. */
  function aoPassoSimulacao() {
    const diagrama = diagramaLd(projetoRef.current)
    if (!diagrama) return
    const ambienteOn = painelAmbienteAbertoRef.current && ambienteIdRef.current === AMBIENTE_PORTAO.id
    setSimulacao((atual) => {
      if (!atual.ativo) return atual
      const resultado = executarCicloComAmbiente(diagrama, atual.estado, plantaPortaoRef.current, AMBIENTE_PORTAO, ambienteOn)
      if (resultado.falha) registrarFalhaPlanta(resultado.falha)
      setPlantaPortao(resultado.planta)
      return { ...atual, estado: resultado.estado }
    })
  }

  /** Reiniciar (CA-6): volta ao estado inicial completo (`reiniciar` = o
   * mesmo que `criarEstado`) — zera variáveis, contadores e a contagem de
   * ciclos; não sai do modo simulação nem muda Executar/Pausar. */
  function aoReiniciarSimulacao() {
    const atual = simulacaoRef.current
    if (!atual.ativo) return
    const diagrama = diagramaLd(projetoRef.current)
    if (!diagrama) return
    setSimulacao({ ...atual, estado: reiniciar(diagrama) })
    if (painelAmbienteAbertoRef.current && ambienteIdRef.current === AMBIENTE_PORTAO.id) {
      setPlantaPortao(criarEstadoPortao())
    }
  }

  function aoComandoAmbiente(comando: string, pressionado: boolean) {
    if (ambienteIdRef.current !== AMBIENTE_PORTAO.id) return
    setPlantaPortao((p) => AMBIENTE_PORTAO.acionarComando(p, comando, pressionado))
  }

  function aoEscolherMarchaSimulacao(marchaId: string) {
    setSimulacao((atual) => (atual.ativo ? { ...atual, marchaId } : atual))
  }

  function aoFecharAmbiente() {
    setPainelAmbienteAberto(false)
    if (simulacaoRef.current.ativo) {
      setSimulacao({ ativo: false })
      log('info', 'Simulação encerrada junto com o ambiente.')
    }
  }

  function aoAlternarPainelAmbiente() {
    if (painelAmbienteAberto) aoFecharAmbiente()
    else setModalAmbienteAberto(true)
  }

  /** Criação de variável pelo contrato de E/S do ambiente (spec 005, revisão
   * 2026-09-23): mesmo `declararVariavel` da tabela, pelo mesmo
   * `aoMudarProjeto` — entra no histórico de Desfazer. A recusa volta para o
   * modal, que a mostra junto do campo. Congelada durante a simulação, como a
   * edição do diagrama (spec 004, Q-7). */
  function aoDeclararVariavelAmbiente(ponto: PontoAmbiente, nome: string): string | null {
    if (simulacao.ativo) return MOTIVO_CRIACAO_EM_SIMULACAO
    if (projeto.linguagem !== 'ld') return null
    const resultado = declararVariavel(projeto.diagrama, { nome, endereco: ponto.endereco })
    if (!resultado.ok) return resultado.motivo
    aoMudarProjeto({ ...projeto, diagrama: resultado.diagrama })
    log('info', `Variável «${nome}» criada em ${ponto.endereco} pelo contrato do ambiente.`)
    return null
  }

  /** "Criar todas": uma variável por ponto não conectado, tudo ou nada, numa
   * única entrada do histórico. Sem modal, a recusa vai ao toast. */
  function aoDeclararTodasAmbiente() {
    if (simulacao.ativo || projeto.linguagem !== 'ld') return
    const definicao = ambientePorId(ambienteId)
    if (!definicao) return
    const antes = projeto.diagrama.variaveis.length
    const resultado = declararVariaveisDoContrato(projeto.diagrama, definicao.pontos)
    if (!resultado.ok) {
      recusar(resultado.motivo)
      return
    }
    const criadas = resultado.diagrama.variaveis.length - antes
    if (criadas === 0) return
    aoMudarProjeto({ ...projeto, diagrama: resultado.diagrama })
    log('info', `${criadas} variáve${criadas === 1 ? 'l criada' : 'is criadas'} pelo contrato do ambiente ${definicao.nome}.`)
  }

  /** Aciona uma entrada durante a simulação (RF-12): repassado a
   * `PainelVariaveis`/`TabelaVariaveis` como `aoAcionar`. Uma recusa do
   * núcleo (variável que não é de entrada — não deveria ser alcançável, já
   * que só entradas ganham o controle acionável, mas o núcleo decide, não a
   * tela) vai pelo mesmo caminho de recusa de sempre (`recusar` → toast). */
  function aoAcionarEntradaSimulacao(nome: string, nivel: boolean) {
    const atual = simulacaoRef.current
    if (!atual.ativo) return
    const diagrama = diagramaLd(projetoRef.current)
    if (!diagrama) return
    const resultado = acionarEntrada(diagrama, atual.estado, nome, nivel)
    if (!resultado.ok) {
      recusar(resultado.motivo)
      return
    }
    setSimulacao({ ...atual, estado: resultado.estado })
  }

  /**
   * O relógio da simulação (RF-11, plano D-8): um laço em
   * `requestAnimationFrame`, ativo só enquanto `simulacao.ativo && rodando`.
   * A cada quadro, calcula quantos ciclos cabem no tempo decorrido desde o
   * último (`floor(dt / intervalo)`), executa todos em sequência sobre o
   * mesmo `EstadoSimulacao` e aplica **um único** `setSimulacao` — nunca um
   * `setState` por ciclo. `MAX_CICLOS_POR_QUADRO` protege a aba de tentar
   * recuperar em rajada um atraso grande (janela em segundo plano): acima do
   * teto, o relógio de referência é ressincronizado com o presente em vez de
   * perseguir os ciclos perdidos.
   *
   * A marcha (intervalo) é lida de `simulacaoRef` a cada quadro, não capturada
   * no fechamento do efeito — trocar de marcha em pleno "Executar" tem efeito
   * imediato, sem reiniciar o laço.
   */
  const simulacaoRodandoAgora = simulacao.ativo && simulacao.rodando

  useEffect(() => {
    if (!simulacao.ativo || !simulacao.rodando) return

    let rafId = 0
    let ultimoTempo: number | null = null

    function quadro(agora: number) {
      if (ultimoTempo === null) {
        ultimoTempo = agora
        rafId = requestAnimationFrame(quadro)
        return
      }

      const atual = simulacaoRef.current
      const intervalo = atual.ativo ? intervaloDaMarcha(atual.marchaId) : INTERVALO_TEMPO_REAL_MS
      const dt = agora - ultimoTempo
      const ciclosCabidos = Math.floor(dt / intervalo)

      if (ciclosCabidos > 0) {
        const ciclos = Math.min(ciclosCabidos, MAX_CICLOS_POR_QUADRO)
        ultimoTempo = ciclosCabidos > MAX_CICLOS_POR_QUADRO ? agora : ultimoTempo + ciclos * intervalo

        const diagramaAtual = diagramaLd(projetoRef.current)
        if (diagramaAtual) {
          setSimulacao((estadoAtual) => {
            if (!estadoAtual.ativo) return estadoAtual
            let estado = estadoAtual.estado
            let planta = plantaPortaoRef.current
            const ambienteOn =
              painelAmbienteAbertoRef.current && ambienteIdRef.current === AMBIENTE_PORTAO.id
            let falha: string | null = null
            for (let i = 0; i < ciclos; i++) {
              const passo = executarCicloComAmbiente(diagramaAtual, estado, planta, AMBIENTE_PORTAO, ambienteOn)
              estado = passo.estado
              planta = passo.planta
              if (passo.falha) {
                falha = passo.falha
                break
              }
            }
            plantaPortaoRef.current = planta
            setPlantaPortao(planta)
            if (falha) {
              queueMicrotask(() => registrarFalhaPlanta(falha))
            }
            return { ...estadoAtual, estado, rodando: falha ? false : estadoAtual.rodando }
          })
        }
      }

      rafId = requestAnimationFrame(quadro)
    }

    rafId = requestAnimationFrame(quadro)
    return () => cancelAnimationFrame(rafId)
    // `simulacaoRodandoAgora` (não `simulacao.rodando` cru) porque `Projeto`
    // e `EstadoModoSimulacao` são uniões discriminadas: acessar `.rodando`
    // direto num array de dependências não estreita `simulacao.ativo` da
    // mesma expressão (só um `if`/`?:` local estreita) — ver `diagramaLd`.
  }, [simulacao.ativo, simulacaoRodandoAgora])

  /** Clicar num problema (herdado da tarefa #13): pede ao `EditorLadder` para
   * focar a célula do problema — `token` incrementa a cada escolha para
   * repetir o mesmo alvo duas vezes seguidas ainda disparar o foco. */
  function aoEscolherProblema(problema: Problema) {
    focoToken.current += 1
    setFoco({ rungId: problema.rungId, elementoId: problema.elementoId, token: focoToken.current })
  }

  /** Primeiro passo do fluxo "Novo projeto" (tarefa #26): só pergunta antes
   * de descartar quando há algo a perder (`projetoTemConteudo`) — projeto
   * vazio (padrão logo após abrir, ou após o próprio "Novo projeto") vai
   * direto ao modal de título. */
  function aoNovoProjeto() {
    setModalNovoProjeto(projetoTemConteudo(projeto) ? 'confirmarDescarte' : 'novoProjeto')
  }

  function aoConfirmarDescarte() {
    setModalNovoProjeto('novoProjeto')
  }

  function aoCancelarModalNovoProjeto() {
    setModalNovoProjeto('nenhum')
  }

  /** Segundo (ou único, se o projeto atual já estava vazio) passo do fluxo
   * "Novo projeto": substitui o projeto, limpa o estado que só fazia sentido
   * para o anterior (compilação, gravação, foco), fecha os modais, registra
   * no Console e devolve o foco ao botão "Novo projeto" — ele não é
   * referenciável por `ref` (mora em `BarraSuperior`, fora desta frente), daí
   * a busca pelo `aria-label` fixo do próprio botão. */
  function aoCriarProjeto(titulo: string, linguagem: Linguagem) {
    const novo = novoProjeto(titulo, linguagem)
    setHistorico(criarHistorico(novo))
    setProjeto(novo)
    setCompilacao({ fase: 'ocioso' })
    setGravacao({ fase: 'ocioso' })
    // Defensivo (spec 004): "Novo projeto" troca o diagrama inteiro por
    // baixo de uma simulação que estaria rodando sobre o anterior — sem
    // caminho de UI hoje para chegar aqui com `simulacao.ativo` (o editor
    // está congelado, então "Novo projeto" seguiria funcionando, mas
    // encerrar a simulação é o comportamento seguro caso isso mude).
    setSimulacao({ ativo: false })
    setFoco(null)
    setModalNovoProjeto('nenhum')
    log('info', `Projeto «${novo.titulo}» (${linguagem.toUpperCase()}) criado.`)
    document.querySelector<HTMLButtonElement>('[aria-label="Novo projeto"]')?.focus()
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-ide-fundo text-ide-texto">
      <BarraSuperior
        titulo={projeto.titulo}
        linguagem={projeto.linguagem}
        aoNovoProjeto={aoNovoProjeto}
        compilando={compilando}
        aoCompilar={aoCompilar}
        gravando={gravando}
        progressoGravacao={gravacao.fase === 'gravando' ? gravacao.progresso : undefined}
        podeGravar={podeGravar}
        aoGravar={aoGravar}
        opcoesDownload={opcoesDownload}
        aoBaixar={aoBaixar}
        motivoIndisponivel={motivoIndisponivel}
        painelVariaveisAberto={painelVariaveisAberto}
        aoAlternarPainelVariaveis={() => setPainelVariaveisAberto((atual) => !atual)}
        motivoPainelVariaveisIndisponivel={motivoPainelVariaveisIndisponivel}
        painelInferiorAberto={consoleAberto}
        aoAlternarPainelInferior={() => setConsoleAberto((atual) => !atual)}
        tema={tema}
        aoAlternarTema={aoAlternarTema}
        podeDesfazer={podeDesfazer(historico)}
        podeRefazer={podeRefazer(historico)}
        aoDesfazer={aoDesfazerProjeto}
        aoRefazer={aoRefazerProjeto}
        historicoEdicaoDesabilitado={simulacao.ativo}
      />

      {!webSerialOk && (
        <p className="shrink-0 border-b border-ide-borda bg-ide-elevado px-4 py-1.5 text-xs text-ide-aviso">
          Este navegador não tem suporte à Web Serial API — a gravação fica desabilitada. Use Chrome ou Edge 89+ em{' '}
          <code className="font-mono">localhost</code> ou por HTTPS.
        </p>
      )}

      <div className="flex min-h-0 flex-1">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <BarraSimulacao
            simulando={simulacao.ativo}
            simulacaoRodando={simulacao.ativo && simulacao.rodando}
            motivoSimulacaoIndisponivel={motivoSimulacaoIndisponivel}
            aoAlternarSimulacao={aoAlternarSimulacao}
            aoAlternarExecucaoSimulacao={aoAlternarExecucaoSimulacao}
            aoPassoSimulacao={aoPassoSimulacao}
            aoReiniciarSimulacao={aoReiniciarSimulacao}
            marchas={MARCHAS_SIMULACAO}
            marchaAtual={simulacao.ativo ? simulacao.marchaId : MARCHA_SIMULACAO_PADRAO}
            aoEscolherMarcha={aoEscolherMarchaSimulacao}
            ciclo={simulacao.ativo ? simulacao.estado.ciclo : undefined}
            painelAmbienteAberto={painelAmbienteAberto}
            aoAlternarPainelAmbiente={aoAlternarPainelAmbiente}
            motivoAmbienteIndisponivel={motivoAmbienteIndisponivel}
          />
          <AreaEditor
            projeto={projeto}
            aoMudarProjeto={aoMudarProjeto}
            problemas={problemas}
            foco={foco}
            compilando={compilando}
            erroCompilacao={compilacao.fase === 'erro' ? compilacao.erro : null}
            aoRecusar={recusar}
            congelado={simulacao.ativo}
            simulacao={simulacao.ativo ? { energizacao: simulacao.estado.energizacao, blocos: simulacao.estado.blocos } : null}
            pontosAmbiente={pontosAmbienteAberto}
          />
        </div>

        {projeto.linguagem === 'ld' && (painelAmbienteAberto || painelVariaveisAberto) && (
          <PainelLateral
            aberto
            rotulo={painelAmbienteAberto ? 'Painel de ambiente' : 'Painel de variáveis'}
            largura={painelVariaveisLargura}
            larguraMin={painelAmbienteAberto ? PAINEL_AMBIENTE_LARGURA_MIN : PAINEL_VARIAVEIS_LARGURA_MIN}
            larguraMax={larguraMaxPainel}
            aoRedimensionar={setPainelVariaveisLargura}
          >
            {painelAmbienteAberto ? (
              <PainelAmbiente
                aoFechar={aoFecharAmbiente}
                ambienteId={ambienteId}
                diagrama={projeto.diagrama}
                estadoPlanta={plantaPortao}
                saidasPorEndereco={saidasAmbienteMapa}
                simulacaoAtiva={simulacao.ativo}
                aoComando={aoComandoAmbiente}
                aoDeclararVariavel={aoDeclararVariavelAmbiente}
                aoDeclararTodas={aoDeclararTodasAmbiente}
                motivoCriacaoIndisponivel={simulacao.ativo ? MOTIVO_CRIACAO_EM_SIMULACAO : undefined}
              />
            ) : (
              <PainelVariaveis
                diagrama={projeto.diagrama}
                aoMudar={(diagrama) => aoMudarProjeto({ ...projeto, diagrama })}
                aoRecusar={recusar}
                valores={simulacao.ativo ? simulacao.estado.variaveis : undefined}
                aoAcionar={simulacao.ativo ? aoAcionarEntradaSimulacao : undefined}
                ciclo={simulacao.ativo ? simulacao.estado.ciclo : undefined}
                enderecosComandadosPelaPlanta={enderecosComandadosPelaPlanta}
                motivoEntradaPlanta={motivoEntradaPlanta}
                simulacaoAtiva={simulacao.ativo}
              />
            )}
          </PainelLateral>
        )}
      </div>

      {modalAmbienteAberto && (
        <ModalAmbiente
          aoCancelar={() => setModalAmbienteAberto(false)}
          aoConfirmar={(id) => {
            setAmbienteId(id)
            setPlantaPortao(criarEstadoPortao())
            setModalAmbienteAberto(false)
            setPainelAmbienteAberto(true)
          }}
        />
      )}

      {modalPortaSerialAberto && (
        <ModalPortaSerial
          aoCancelar={() => {
            setModalPortaSerialAberto(false)
            log('info', 'Gravação cancelada.')
          }}
          aoConfirmar={(porta) => {
            setModalPortaSerialAberto(false)
            void executarGravacao(porta)
          }}
        />
      )}

      <PainelInferior
        aberto={consoleAberto}
        altura={consoleAltura}
        alturaMin={CONSOLE_ALTURA_MIN}
        alturaMax={alturaMaximaConsole()}
        aoRedimensionar={setConsoleAltura}
      >
        <PainelInferiorConteudo
          aba={abaInferior}
          aoMudarAba={setAbaInferior}
          problemas={problemas}
          aoEscolherProblema={aoEscolherProblema}
          entradasConsole={entradasConsole}
          aoLimparConsole={() => setEntradasConsole([])}
        />
      </PainelInferior>

      <Toasts toasts={toasts} aoFechar={fecharToast} />

      {modalNovoProjeto === 'confirmarDescarte' && (
        <ModalConfirmarDescarte
          tituloProjeto={projeto.titulo}
          aoConfirmar={aoConfirmarDescarte}
          aoCancelar={aoCancelarModalNovoProjeto}
        />
      )}
      {modalNovoProjeto === 'novoProjeto' && <ModalNovoProjeto aoCriar={aoCriarProjeto} aoCancelar={aoCancelarModalNovoProjeto} />}
    </div>
  )
}
