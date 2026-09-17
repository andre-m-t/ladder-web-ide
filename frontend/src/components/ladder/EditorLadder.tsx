/**
 * Editor Ladder da fatia 1 (spec 002, plano D-3/D-4, tarefa #7; ajuste de
 * interação, plano D-11, tarefa #21).
 *
 * Orquestra o núcleo puro (`ladder/edicao.ts`) e os componentes de desenho
 * (`Paleta`, `GradeDegrau`, `PainelVariaveis`): mantém o `Diagrama` em estado
 * React e a ferramenta/seleção ativas, mas nunca decide sozinho se uma edição
 * é válida — toda mudança passa por uma operação de `edicao.ts`, que ou
 * devolve o novo diagrama, ou recusa com um motivo em português.
 *
 * A recusa de uma ação sobre célula (inserir/remover) nunca altera o diagrama
 * e aparece em `role="alert"` **logo abaixo da grade do degrau afetado**
 * (D-11) — não mais no alerta do painel de variáveis. Recusa de painel
 * (declarar/vincular variável) continua em `erro` de `PainelVariaveis`.
 *
 * Interação por seleção (D-4, R-2): escolhe-se uma ferramenta na paleta (ou
 * nenhuma) e depois a célula de destino. Sem ferramenta, clicar/Enter numa
 * célula só seleciona o elemento ali (ou limpa a seleção, se vazia) — é como
 * se prepara o vínculo de variável no painel. `Esc` cancela a ferramenta
 * ativa e limpa as duas recusas (célula e painel).
 *
 * Prévia (D-11): a célula sob o mouse **ou** o foco de teclado ganha uma
 * prévia da jogada da ferramenta ativa, calculada chamando a própria operação
 * do núcleo sobre o estado atual sem aplicá-la — o que a prévia promete é
 * exatamente o que o clique fará, sem regra de posição duplicada na UI.
 *
 * Sem lista de problemas nesta fatia (entra na tarefa #13): `validarDiagrama`
 * não é chamado aqui.
 */
import { useState, type KeyboardEvent } from 'react'

import { declararVariavel, diagramaVazio, inserirElemento, removerElemento, vincularVariavel } from '../../ladder/edicao'
import type { ResultadoEdicao } from '../../ladder/edicao'
import type { Celula, Diagrama, Elemento } from '../../ladder/modelo'
import GradeDegrau, { type Previa } from './GradeDegrau'
import Paleta, { type Ferramenta } from './Paleta'
import PainelVariaveis from './PainelVariaveis'

export interface EditorLadderProps {
  /** Diagrama de partida; por padrão, um degrau vazio (`diagramaVazio()`). */
  diagramaInicial?: Diagrama
  /** Chamado a cada mudança bem-sucedida do diagrama (persistência é a tarefa #12). */
  aoMudar?: (diagrama: Diagrama) => void
}

/** Recusa de uma ação sobre célula, localizada no degrau e na célula afetados. */
interface RecusaCelula {
  rungId: string
  celula: Celula
  motivo: string
}

function elementoNaCelula(diagrama: Diagrama, rungId: string, celula: Celula): Elemento | undefined {
  const rung = diagrama.rungs.find((r) => r.id === rungId)
  return rung?.elementos.find((e) => e.celula.linha === celula.linha && e.celula.coluna === celula.coluna)
}

function elementoPorId(diagrama: Diagrama, id: string | null): Elemento | null {
  if (id === null) return null
  for (const rung of diagrama.rungs) {
    const encontrado = rung.elementos.find((e) => e.id === id)
    if (encontrado !== undefined) return encontrado
  }
  return null
}

/** Prévia da jogada da ferramenta ativa sobre `celula`, calculada chamando o
 * núcleo sem aplicar (D-11) — nenhuma regra de posição reimplementada aqui. */
function calcularPrevia(diagrama: Diagrama, ferramenta: Ferramenta | null, rungId: string, celula: Celula): Previa | null {
  if (ferramenta === null) return null

  if (ferramenta === 'remover') {
    const elemento = elementoNaCelula(diagrama, rungId, celula)
    if (elemento === undefined) {
      return { celula, tipo: 'invalida', motivo: 'célula vazia: não há elemento para remover' }
    }
    return { celula, tipo: 'remover' }
  }

  const resultado = inserirElemento(diagrama, rungId, ferramenta, celula)
  if (resultado.ok) {
    return { celula, tipo: 'inserir', elemento: ferramenta }
  }
  return { celula, tipo: 'invalida', motivo: resultado.motivo }
}

export default function EditorLadder({ diagramaInicial, aoMudar }: EditorLadderProps = {}) {
  const [diagrama, setDiagrama] = useState<Diagrama>(diagramaInicial ?? diagramaVazio())
  const [ferramenta, setFerramenta] = useState<Ferramenta | null>(null)
  const [selecionado, setSelecionado] = useState<string | null>(null)
  const [celulaSobCursor, setCelulaSobCursor] = useState<{ rungId: string; celula: Celula } | null>(null)
  const [recusa, setRecusa] = useState<RecusaCelula | null>(null)
  const [erroPainel, setErroPainel] = useState<string | null>(null)

  /** Aplica o `ResultadoEdicao` de uma ação sobre célula: recusa vira
   * `recusa` (localizada em rung + célula) sem tocar no diagrama; sucesso
   * troca o diagrama, limpa `recusa` e avisa `aoMudar`. */
  function aplicarResultadoCelula(resultado: ResultadoEdicao, rungId: string, celula: Celula) {
    if (!resultado.ok) {
      setRecusa({ rungId, celula, motivo: resultado.motivo })
      return
    }
    setDiagrama(resultado.diagrama)
    setRecusa(null)
    aoMudar?.(resultado.diagrama)
  }

  /** Aplica o `ResultadoEdicao` de uma ação do painel (declarar/vincular
   * variável): recusa vira `erroPainel`, exibido pelo próprio painel. */
  function aplicarResultadoPainel(resultado: ResultadoEdicao) {
    if (!resultado.ok) {
      setErroPainel(resultado.motivo)
      return
    }
    setDiagrama(resultado.diagrama)
    setErroPainel(null)
    aoMudar?.(resultado.diagrama)
  }

  function aoAtivarCelula(rungId: string, celula: Celula) {
    if (ferramenta === null) {
      const elemento = elementoNaCelula(diagrama, rungId, celula)
      setSelecionado(elemento ? elemento.id : null)
      return
    }

    if (ferramenta === 'remover') {
      const elemento = elementoNaCelula(diagrama, rungId, celula)
      if (elemento === undefined) {
        setRecusa({ rungId, celula, motivo: 'célula vazia: não há elemento para remover' })
        return
      }
      const resultado = removerElemento(diagrama, elemento.id)
      aplicarResultadoCelula(resultado, rungId, celula)
      if (resultado.ok && selecionado === elemento.id) {
        // ids são reaproveitados pelo núcleo: uma seleção velha não pode
        // continuar apontando para um elemento que ainda nem existe.
        setSelecionado(null)
      }
      return
    }

    const resultado = inserirElemento(diagrama, rungId, ferramenta, celula)
    aplicarResultadoCelula(resultado, rungId, celula)
    if (resultado.ok) {
      const novoElemento = elementoNaCelula(resultado.diagrama, rungId, celula)
      setSelecionado(novoElemento ? novoElemento.id : null)
    }
  }

  function aoPassarCelula(rungId: string, celula: Celula | null) {
    setCelulaSobCursor(celula ? { rungId, celula } : null)
  }

  function aoEscolherFerramenta(nova: Ferramenta | null) {
    setFerramenta(nova)
    setRecusa(null)
  }

  function aoDeclarar(variavel: { nome: string; endereco?: string }) {
    aplicarResultadoPainel(declararVariavel(diagrama, variavel))
  }

  function aoVincular(elementoId: string, nome: string | null) {
    aplicarResultadoPainel(vincularVariavel(diagrama, elementoId, nome))
  }

  function aoTeclarNoEditor(evento: KeyboardEvent<HTMLDivElement>) {
    if (evento.key === 'Escape') {
      setFerramenta(null)
      setRecusa(null)
      setErroPainel(null)
    }
  }

  const previa: Previa | null = celulaSobCursor
    ? calcularPrevia(diagrama, ferramenta, celulaSobCursor.rungId, celulaSobCursor.celula)
    : null

  return (
    <div onKeyDown={aoTeclarNoEditor}>
      <Paleta ativa={ferramenta} aoEscolher={aoEscolherFerramenta} />

      <div className="mt-4">
        {diagrama.rungs.map((rung, indice) => (
          <GradeDegrau
            key={rung.id}
            rung={rung}
            indice={indice}
            selecionado={selecionado}
            aoAtivarCelula={aoAtivarCelula}
            aoPassarCelula={aoPassarCelula}
            previa={celulaSobCursor && celulaSobCursor.rungId === rung.id ? previa : null}
            recusa={recusa && recusa.rungId === rung.id ? { celula: recusa.celula, motivo: recusa.motivo } : null}
          />
        ))}
      </div>

      <div className="mt-4">
        <PainelVariaveis
          variaveis={diagrama.variaveis}
          elementoSelecionado={elementoPorId(diagrama, selecionado)}
          aoDeclarar={aoDeclarar}
          aoVincular={aoVincular}
          erro={erroPainel}
        />
      </div>
    </div>
  )
}
