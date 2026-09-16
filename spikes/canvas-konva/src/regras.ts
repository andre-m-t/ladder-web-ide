// Lógica de colocação de elementos, isolada do Konva/React para poder ser
// testada diretamente (ver MEDICOES.md, item 3/4: teste de UI via canvas tem
// limites em jsdom, então a regra de negócio mora aqui, sem depender de DOM).
import type { Celula, Diagrama, Rung, TipoBobina, TipoContato } from './modelo'

export type TipoPaleta = TipoContato | TipoBobina

export interface ResultadoColocacao {
  diagrama: Diagrama
  erro: string | null
}

const TIPOS_BOBINA: TipoBobina[] = ['bobina', 'bobina_set', 'bobina_reset']

function ehBobina(tipo: TipoPaleta): tipo is TipoBobina {
  return (TIPOS_BOBINA as string[]).includes(tipo)
}

/** Cria os 3 rungs do mínimo do spike: 6 colunas cada, só linha 0. */
export function diagramaInicial(): Diagrama {
  const rungs: Rung[] = [0, 1, 2].map((i) => ({
    id: `rung-${i}`,
    colunas: 6,
    elementos: [],
    ramos: [],
  }))
  return { versao: 1, variaveis: [], rungs }
}

/**
 * Tenta colocar um elemento de paleta numa célula de um rung.
 * Regra mínima: bobina só na última coluna; contato só antes dela; célula
 * já ocupada também é rejeitada. Em caso de erro, retorna o mesmo `diagrama`
 * (identidade preservada) e uma mensagem — nunca muta o modelo recebido.
 */
export function tentarColocar(
  diagrama: Diagrama,
  rungId: string,
  celula: Celula,
  tipo: TipoPaleta,
): ResultadoColocacao {
  const rung = diagrama.rungs.find((r) => r.id === rungId)
  if (!rung) {
    return { diagrama, erro: `rung ${rungId} não existe` }
  }

  const ultimaColuna = rung.colunas - 1
  if (ehBobina(tipo) && celula.coluna !== ultimaColuna) {
    return { diagrama, erro: 'bobina só pode ser colocada na última coluna do rung' }
  }
  if (!ehBobina(tipo) && celula.coluna >= ultimaColuna) {
    return { diagrama, erro: 'contato não pode ocupar a última coluna (reservada à bobina)' }
  }

  const ocupada = rung.elementos.some(
    (e) => e.celula.linha === celula.linha && e.celula.coluna === celula.coluna,
  )
  if (ocupada) {
    return { diagrama, erro: 'célula já ocupada' }
  }

  const novoRung: Rung = {
    ...rung,
    elementos: [...rung.elementos, { id: `${rungId}-${celula.linha}-${celula.coluna}`, tipo, celula, variavel: null }],
  }

  return {
    diagrama: { ...diagrama, rungs: diagrama.rungs.map((r) => (r.id === rungId ? novoRung : r)) },
    erro: null,
  }
}
