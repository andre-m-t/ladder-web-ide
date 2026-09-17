import { useEffect, useMemo, useRef, useState } from 'react'

import AreaEditor, { type FocoLadder } from './components/ide/AreaEditor'
import BarraSuperior, { type Aba } from './components/ide/BarraSuperior'
import PainelInferior from './components/ide/PainelInferior'
import PainelInferiorConteudo, { type AbaInferior } from './components/ide/PainelInferiorConteudo'
import PainelLateral from './components/ide/PainelLateral'
import PainelVariaveis from './components/ladder/PainelVariaveis'
import { diagramaVazio } from './ladder/edicao'
import type { Diagrama } from './ladder/modelo'
import { carregarDiagrama, salvarDiagrama, type ResultadoCarga } from './ladder/persistencia'
import { validarDiagrama, type Problema } from './ladder/validacao'
import {
  compilarPacote,
  ErroCompilacao,
  ErroHttpCompilacao,
  ErroRedeCompilacao,
  fetchHealth,
  type Pacote,
  type ToolInfo,
} from './lib/api'
import { registrar, type EntradaConsole } from './lib/console'
import { BLINK_ST } from './lib/exemplos'
import { ErroGravacao, gravar, webSerialDisponivel } from './lib/gravador'
import { aplicarTema, temaInicial, type Tema } from './lib/tema'

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

// --- Preferências de interface (localStorage) -------------------------------
// Só o layout da IDE — aba ativa, tamanhos e recolhimentos dos painéis. O
// tema tem seu próprio armazenamento em `lib/tema.ts`. O diagrama e o texto
// ST em edição NUNCA entram aqui (persistência do diagrama é a tarefa #12).
// Leitura e escrita em try/catch: sem `localStorage` disponível, a IDE usa os
// padrões abaixo sem quebrar.

const CHAVE_ABA = 'ladderflow.aba'
const CHAVE_ABA_INFERIOR = 'ladderflow.abaInferior'
const CHAVE_PAINEL_ABERTO = 'ladderflow.painelAberto'
const CHAVE_PAINEL_LARGURA = 'ladderflow.painelLargura'
const CHAVE_CONSOLE_ABERTO = 'ladderflow.consoleAberto'
const CHAVE_CONSOLE_ALTURA = 'ladderflow.consoleAltura'

const PAINEL_LARGURA_PADRAO = 320
const PAINEL_LARGURA_MIN = 288 // 18rem
const PAINEL_LARGURA_MAX = 640 // 40rem
const CONSOLE_ALTURA_PADRAO = 192
const CONSOLE_ALTURA_MIN = 96 // 6rem

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

function lerAba(): Aba {
  return lerPreferencia(CHAVE_ABA, (bruto) => (bruto === 'ladder' || bruto === 'st' ? bruto : null), 'ladder')
}

/** Aba do painel inferior (tarefa #13): "console" é o padrão — os testes e o
 * fluxo de compilação/gravação já esperam o console visível sem precisar
 * trocar de aba. */
function lerAbaInferior(): AbaInferior {
  return lerPreferencia(CHAVE_ABA_INFERIOR, (bruto) => (bruto === 'problemas' || bruto === 'console' ? bruto : null), 'console')
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

/** Carga inicial do diagrama (tarefa #12, CA-8): `carregarDiagrama` já nunca
 * lança, mas o próprio acesso à propriedade `window.localStorage` pode
 * lançar em alguns navegadores (modo privado) antes mesmo de chegar a
 * `getItem` — protegido aqui do mesmo jeito que `lerPreferencia` protege as
 * preferências de layout. */
function carregarDiagramaInicial(): ResultadoCarga {
  try {
    return carregarDiagrama(window.localStorage)
  } catch {
    return { diagrama: diagramaVazio(), aviso: 'diagrama salvo descartado: não foi possível acessar o armazenamento local' }
  }
}

/**
 * Shell de IDE do LadderFlow (spec 002, tarefas #23/#24, plano
 * `agora-precisamos-trabalhar-em-cozy-dragon.md`, D-13/D-14): tela inteira com
 * barra superior (abas, compilar/gravar, alternadores — ícones `lucide-react`,
 * sem chips de saúde), editor central por aba (Ladder controlado / ST),
 * painel de variáveis recolhível e redimensionável à direita, e console de
 * eventos do cliente recolhível e redimensionável embaixo. A saúde do
 * servidor de compilação (`/health`) não aparece mais na barra: uma linha por
 * ferramenta (MATIEC, toolchain ESP32) vai para o console na carga inicial.
 *
 * O diagrama do editor Ladder já sobe para cá (`useState<Diagrama>`), como
 * preparação para a tarefa #12 (persistência) — aqui ele só vive em memória,
 * compartilhado entre o editor (aba Ladder) e `PainelVariaveis` (painel
 * lateral). O servidor de compilação continua síncrono (spec 001, Q-6): o
 * console mostra os eventos que o próprio cliente observa (início/fim,
 * progresso), não um streaming da saída do `iec2c`/`idf.py`.
 */
export default function App() {
  const [tema, setTema] = useState<Tema>(() => temaInicial())
  const [aba, setAba] = useState<Aba>(() => lerAba())
  const [abaInferior, setAbaInferior] = useState<AbaInferior>(() => lerAbaInferior())

  // Carga inicial do diagrama (CA-8): uma única leitura do `localStorage` no
  // mount, guardada aqui para o efeito de log abaixo reaproveitar o mesmo
  // resultado (diagrama e aviso nascem juntos, de uma só leitura).
  const [cargaInicial] = useState<ResultadoCarga>(() => carregarDiagramaInicial())
  const [diagrama, setDiagrama] = useState<Diagrama>(() => cargaInicial.diagrama)
  const [fonte, setFonte] = useState(BLINK_ST)
  const [foco, setFoco] = useState<FocoLadder | null>(null)

  const [painelAberto, setPainelAberto] = useState(() => lerBooleano(CHAVE_PAINEL_ABERTO, true))
  const [painelLargura, setPainelLargura] = useState(() =>
    Math.min(PAINEL_LARGURA_MAX, Math.max(PAINEL_LARGURA_MIN, lerNumero(CHAVE_PAINEL_LARGURA, PAINEL_LARGURA_PADRAO))),
  )
  const [consoleAberto, setConsoleAberto] = useState(() => lerBooleano(CHAVE_CONSOLE_ABERTO, true))
  const [consoleAltura, setConsoleAltura] = useState(() =>
    Math.max(CONSOLE_ALTURA_MIN, lerNumero(CHAVE_CONSOLE_ALTURA, CONSOLE_ALTURA_PADRAO)),
  )

  const [compilacao, setCompilacao] = useState<EstadoCompilacao>({ fase: 'ocioso' })
  const [gravacao, setGravacao] = useState<EstadoGravacao>({ fase: 'ocioso' })
  const [entradasConsole, setEntradasConsole] = useState<EntradaConsole[]>([])

  const problemas = useMemo(() => validarDiagrama(diagrama), [diagrama])

  const cargaInicialRegistrada = useRef(false)
  /** Falha de `salvarDiagrama` já registrada no console: evita inundar o
   * console a cada tecla enquanto o armazenamento continuar recusando —
   * registra de novo só quando a gravação volta a falhar depois de um
   * sucesso (tarefa #12). */
  const falhaSalvarRegistrada = useRef(false)
  const focoToken = useRef(0)

  function log(nivel: EntradaConsole['nivel'], mensagem: string) {
    setEntradasConsole((atual) => registrar(atual, nivel, mensagem))
  }

  useEffect(() => {
    if (cargaInicialRegistrada.current) return
    cargaInicialRegistrada.current = true
    document.title = '🔧 LadderFlow'
    log('info', 'LadderFlow iniciado.')
    if (cargaInicial.aviso) log('aviso', cargaInicial.aviso)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Salva o diagrama a cada mudança (tarefa #12, D-5). Roda também no mount
  // (reescreve o que acabou de ser carregado — inofensivo) para cobrir o
  // caso comum: primeiro diagrama nunca salvo ainda. `window.localStorage`
  // pode lançar ao ser acessado (não só nos métodos) em alguns navegadores;
  // protegido do mesmo jeito que a carga inicial.
  useEffect(() => {
    let erro: string | null
    try {
      erro = salvarDiagrama(window.localStorage, diagrama)
    } catch {
      erro = 'não foi possível salvar o diagrama no armazenamento local'
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
  }, [diagrama])

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

  useEffect(() => gravarPreferencia(CHAVE_ABA, aba), [aba])
  useEffect(() => gravarPreferencia(CHAVE_ABA_INFERIOR, abaInferior), [abaInferior])
  useEffect(() => gravarPreferencia(CHAVE_PAINEL_ABERTO, String(painelAberto)), [painelAberto])
  useEffect(() => gravarPreferencia(CHAVE_PAINEL_LARGURA, String(painelLargura)), [painelLargura])
  useEffect(() => gravarPreferencia(CHAVE_CONSOLE_ABERTO, String(consoleAberto)), [consoleAberto])
  useEffect(() => gravarPreferencia(CHAVE_CONSOLE_ALTURA, String(consoleAltura)), [consoleAltura])

  const compilando = compilacao.fase === 'compilando'
  const gravando = gravacao.fase === 'gravando'
  const temPacoteValido = compilacao.fase === 'sucesso'
  const webSerialOk = webSerialDisponivel()
  const podeGravar = temPacoteValido && webSerialOk && !gravando

  async function aoCompilar() {
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
      } else {
        log('erro', `Falha na compilação após ${decorrido}s: ${erroTratado.message}`)
      }
    }
  }

  async function aoGravar() {
    if (compilacao.fase !== 'sucesso') return

    setGravacao({ fase: 'gravando', progresso: 0 })
    log('info', 'Gravação iniciada.')
    let ultimaDezena = -1

    try {
      await gravar(compilacao.pacote, {
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

  /** Clicar num problema (tarefa #13, item 4): troca para a aba Ladder (se
   * estiver em ST) e pede ao `EditorLadder` para focar a célula do
   * problema — `token` incrementa a cada escolha para repetir o mesmo alvo
   * duas vezes seguidas ainda disparar o foco. */
  function aoEscolherProblema(problema: Problema) {
    if (aba !== 'ladder') setAba('ladder')
    focoToken.current += 1
    setFoco({ rungId: problema.rungId, elementoId: problema.elementoId, token: focoToken.current })
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-ide-fundo text-ide-texto">
      <BarraSuperior
        aba={aba}
        aoMudarAba={setAba}
        compilando={compilando}
        aoCompilar={aoCompilar}
        gravando={gravando}
        progressoGravacao={gravacao.fase === 'gravando' ? gravacao.progresso : undefined}
        podeGravar={podeGravar}
        aoGravar={aoGravar}
        painelVariaveisAberto={painelAberto}
        aoAlternarPainelVariaveis={() => setPainelAberto((atual) => !atual)}
        consoleAberto={consoleAberto}
        aoAlternarConsole={() => setConsoleAberto((atual) => !atual)}
        tema={tema}
        aoAlternarTema={aoAlternarTema}
      />

      {!webSerialOk && (
        <p className="shrink-0 border-b border-ide-borda bg-ide-elevado px-4 py-1.5 text-xs text-ide-aviso">
          Este navegador não tem suporte à Web Serial API — a gravação fica desabilitada. Use Chrome ou Edge 89+ em{' '}
          <code className="font-mono">localhost</code> ou por HTTPS.
        </p>
      )}

      <div className="flex min-h-0 flex-1">
        <AreaEditor
          aba={aba}
          diagrama={diagrama}
          aoMudarDiagrama={setDiagrama}
          problemas={problemas}
          foco={foco}
          fonte={fonte}
          aoMudarFonte={setFonte}
          compilando={compilando}
          erroCompilacao={compilacao.fase === 'erro' ? compilacao.erro : null}
        />

        <PainelLateral
          aberto={painelAberto}
          largura={painelLargura}
          larguraMin={PAINEL_LARGURA_MIN}
          larguraMax={PAINEL_LARGURA_MAX}
          aoRedimensionar={setPainelLargura}
        >
          <PainelVariaveis diagrama={diagrama} aoMudar={setDiagrama} />
        </PainelLateral>
      </div>

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
    </div>
  )
}
