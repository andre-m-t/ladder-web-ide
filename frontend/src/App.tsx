import { useEffect, useRef, useState } from 'react'

import AreaEditor from './components/ide/AreaEditor'
import BarraSuperior, { type Aba, type EstadoSaude } from './components/ide/BarraSuperior'
import Console from './components/ide/Console'
import PainelInferior from './components/ide/PainelInferior'
import PainelLateral from './components/ide/PainelLateral'
import PainelVariaveis from './components/ladder/PainelVariaveis'
import { diagramaVazio } from './ladder/edicao'
import type { Diagrama } from './ladder/modelo'
import { compilarPacote, ErroCompilacao, ErroHttpCompilacao, ErroRedeCompilacao, fetchHealth, type Pacote } from './lib/api'
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

/**
 * Shell de IDE do LadderFlow (spec 002, tarefa #23, plano
 * `agora-precisamos-trabalhar-em-cozy-dragon.md`, D-13): tela inteira com
 * barra superior (abas, saúde do servidor, compilar/gravar, alternadores),
 * editor central por aba (Ladder controlado / ST), painel de variáveis
 * recolhível e redimensionável à direita, e console de eventos do cliente
 * recolhível e redimensionável embaixo.
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
  const [diagrama, setDiagrama] = useState<Diagrama>(() => diagramaVazio())
  const [fonte, setFonte] = useState(BLINK_ST)

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
  const [saude, setSaude] = useState<EstadoSaude>({ kind: 'carregando' })
  const [entradasConsole, setEntradasConsole] = useState<EntradaConsole[]>([])

  const cargaInicialRegistrada = useRef(false)

  function log(nivel: EntradaConsole['nivel'], mensagem: string) {
    setEntradasConsole((atual) => registrar(atual, nivel, mensagem))
  }

  useEffect(() => {
    if (cargaInicialRegistrada.current) return
    cargaInicialRegistrada.current = true
    log('info', 'LadderFlow iniciado.')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    let cancelado = false

    fetchHealth()
      .then((health) => {
        if (cancelado) return
        setSaude({ kind: 'ok', health })
        const problemas: string[] = []
        if (!health.iec2c.available) problemas.push('MATIEC indisponível')
        if (!health.esp_idf.available) problemas.push('toolchain ESP32 indisponível')
        if (problemas.length === 0) {
          log('sucesso', 'Servidor de compilação disponível (MATIEC e toolchain ESP32 ok).')
        } else {
          log('aviso', `Servidor de compilação disponível com ressalvas: ${problemas.join(', ')}.`)
        }
      })
      .catch((erro: unknown) => {
        if (cancelado) return
        const mensagem = erro instanceof Error ? erro.message : String(erro)
        setSaude({ kind: 'erro', message: mensagem })
        log('erro', `Servidor de compilação indisponível: ${mensagem}`)
      })

    return () => {
      cancelado = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => gravarPreferencia(CHAVE_ABA, aba), [aba])
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

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-ide-fundo text-ide-texto">
      <BarraSuperior
        aba={aba}
        aoMudarAba={setAba}
        saude={saude}
        compilando={compilando}
        aoCompilar={aoCompilar}
        gravando={gravando}
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
        <Console entradas={entradasConsole} aoLimpar={() => setEntradasConsole([])} />
      </PainelInferior>
    </div>
  )
}
