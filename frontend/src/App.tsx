import { useEffect, useMemo, useRef, useState } from 'react'

import AreaEditor, { type FocoLadder } from './components/ide/AreaEditor'
import BarraSuperior from './components/ide/BarraSuperior'
import ModalConfirmarDescarte from './components/ide/ModalConfirmarDescarte'
import ModalNovoProjeto from './components/ide/ModalNovoProjeto'
import PainelInferior from './components/ide/PainelInferior'
import PainelInferiorConteudo, { type AbaInferior } from './components/ide/PainelInferiorConteudo'
import PainelLateral from './components/ide/PainelLateral'
import PainelVariaveis from './components/ladder/PainelVariaveis'
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
import { ErroGravacao, gravar, webSerialDisponivel } from './lib/gravador'
import { aplicarTema, temaInicial, type Tema } from './lib/tema'
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
// (aberto/altura). A aba ativa dentro do painel inferior
// (Problemas/Mensagens/Console) não persiste: nasce de novo a cada carga,
// conforme a regra da tarefa #25. O tema tem seu próprio armazenamento em
// `lib/tema.ts`. Leitura e escrita em try/catch: sem `localStorage`
// disponível, a IDE usa os padrões abaixo sem quebrar.

const CHAVE_PAINEL_VARIAVEIS_ABERTO = 'ladderflow.painelAberto'
const CHAVE_PAINEL_VARIAVEIS_LARGURA = 'ladderflow.painelLargura'
const CHAVE_CONSOLE_ABERTO = 'ladderflow.consoleAberto'
const CHAVE_CONSOLE_ALTURA = 'ladderflow.consoleAltura'

const PAINEL_VARIAVEIS_LARGURA_PADRAO = 320
const PAINEL_VARIAVEIS_LARGURA_MIN = 288 // 18rem
const PAINEL_VARIAVEIS_LARGURA_MAX = 640 // 40rem
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
  const [abaInferior, setAbaInferior] = useState<AbaInferior>(() =>
    abaInferiorInicial(cargaInicial.projeto, cargaInicial.veioDoArmazenamento),
  )
  const [foco, setFoco] = useState<FocoLadder | null>(null)

  const [painelVariaveisAberto, setPainelVariaveisAberto] = useState(() =>
    lerBooleano(CHAVE_PAINEL_VARIAVEIS_ABERTO, true),
  )
  const [painelVariaveisLargura, setPainelVariaveisLargura] = useState(() =>
    Math.min(
      PAINEL_VARIAVEIS_LARGURA_MAX,
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
  const [mensagens, setMensagens] = useState<EntradaConsole[]>([])
  const [naoLidasMensagens, setNaoLidasMensagens] = useState(0)
  const [modalNovoProjeto, setModalNovoProjeto] = useState<EstadoModalNovoProjeto>('nenhum')

  const problemas = useMemo(() => (projeto.linguagem === 'ld' ? validarDiagrama(projeto.diagrama) : []), [projeto])

  const cargaInicialRegistrada = useRef(false)
  /** Falha de `salvarProjeto` já registrada no console: evita inundar o
   * console a cada tecla enquanto o armazenamento continuar recusando —
   * registra de novo só quando a gravação volta a falhar depois de um
   * sucesso (herdado da tarefa #12). */
  const falhaSalvarRegistrada = useRef(false)
  const focoToken = useRef(0)

  function log(nivel: EntradaConsole['nivel'], mensagem: string) {
    setEntradasConsole((atual) => registrar(atual, nivel, mensagem))
  }

  /** Recusa de uma jogada do editor Ladder ou do painel de variáveis (tarefas
   * #25/#26, `aoRecusar`): grava na lista de Mensagens (nível `aviso`) e
   * incrementa o contador de não lidas, sem trocar de aba — quem decide ver o
   * motivo abre a aba Mensagens por conta própria. */
  function recusar(motivo: string) {
    setMensagens((atual) => registrar(atual, 'aviso', motivo))
    setNaoLidasMensagens((atual) => atual + 1)
  }

  /** Troca a aba do painel inferior — abrir "mensagens" zera o contador de
   * não lidas (tarefa #26): a contagem é "recusas desde a última vez que a
   * aba foi aberta", então abrir já conta como "lida". */
  function aoMudarAbaInferior(aba: AbaInferior) {
    setAbaInferior(aba)
    if (aba === 'mensagens') setNaoLidasMensagens(0)
  }

  useEffect(() => {
    if (cargaInicialRegistrada.current) return
    cargaInicialRegistrada.current = true
    document.title = '🔧 LadderFlow'
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

  /** Compilação de Ladder só existe depois de convertido para ST (F8, futuro)
   * — até lá, `motivoIndisponivel` desabilita Compilar/Gravar juntos na
   * `BarraSuperior` para projeto LD. */
  const motivoIndisponivel: string | undefined =
    projeto.linguagem === 'ld' ? 'Compilação de Ladder disponível quando o diagrama for convertido em ST (F8)' : undefined

  async function aoCompilar() {
    if (projeto.linguagem !== 'st') return
    const fonte = projeto.fonte

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
    setProjeto(novo)
    setCompilacao({ fase: 'ocioso' })
    setGravacao({ fase: 'ocioso' })
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
        motivoIndisponivel={motivoIndisponivel}
        painelVariaveisAberto={painelVariaveisAberto}
        aoAlternarPainelVariaveis={() => setPainelVariaveisAberto((atual) => !atual)}
        painelInferiorAberto={consoleAberto}
        aoAlternarPainelInferior={() => setConsoleAberto((atual) => !atual)}
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
          projeto={projeto}
          aoMudarProjeto={setProjeto}
          problemas={problemas}
          foco={foco}
          compilando={compilando}
          erroCompilacao={compilacao.fase === 'erro' ? compilacao.erro : null}
          aoRecusar={recusar}
        />

        {projeto.linguagem === 'ld' && (
          <PainelLateral
            aberto={painelVariaveisAberto}
            largura={painelVariaveisLargura}
            larguraMin={PAINEL_VARIAVEIS_LARGURA_MIN}
            larguraMax={PAINEL_VARIAVEIS_LARGURA_MAX}
            aoRedimensionar={setPainelVariaveisLargura}
          >
            <PainelVariaveis diagrama={projeto.diagrama} aoMudar={(diagrama) => setProjeto({ ...projeto, diagrama })} aoRecusar={recusar} />
          </PainelLateral>
        )}
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
          aoMudarAba={aoMudarAbaInferior}
          problemas={problemas}
          aoEscolherProblema={aoEscolherProblema}
          mensagens={mensagens}
          naoLidasMensagens={naoLidasMensagens}
          aoLimparMensagens={() => setMensagens([])}
          entradasConsole={entradasConsole}
          aoLimparConsole={() => setEntradasConsole([])}
        />
      </PainelInferior>

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
