/**
 * Diagramas de referência da spec 002 (§2, cenários de referência).
 *
 * Espelham os programas de `backend/tests/fixtures/`. São o gabarito dos
 * testes de construção pela UI (CA-1, CA-2). `BLINK` entra na fatia 4
 * (tarefa #16), junto com o contador.
 */

import { COLUNA_TERMINAL, type Diagrama } from './modelo'

/** `minimal.st`: `saida := NOT entrada;`, variáveis internas (sem endereço). */
export const MINIMAL: Diagrama = {
  versao: 1,
  variaveis: [
    { nome: 'entrada', tipo: 'BOOL' },
    { nome: 'saida', tipo: 'BOOL' },
  ],
  rungs: [
    {
      id: 'r1',
      elementos: [
        { id: 'e1', tipo: 'contato_nf', celula: { linha: 0, coluna: 0 }, variavel: 'entrada' },
        { id: 'e2', tipo: 'bobina', celula: { linha: 0, coluna: COLUNA_TERMINAL }, variavel: 'saida' },
      ],
      ramos: [],
    },
  ],
}

/** `io_espelho.st`: `saida := entrada;`, com `%IX0.1` → `%QX0.1`. */
export const IO_ESPELHO: Diagrama = {
  versao: 1,
  variaveis: [
    { nome: 'entrada', tipo: 'BOOL', endereco: '%IX0.1' },
    { nome: 'saida', tipo: 'BOOL', endereco: '%QX0.1' },
  ],
  rungs: [
    {
      id: 'r1',
      elementos: [
        { id: 'e1', tipo: 'contato_na', celula: { linha: 0, coluna: 0 }, variavel: 'entrada' },
        { id: 'e2', tipo: 'bobina', celula: { linha: 0, coluna: COLUNA_TERMINAL }, variavel: 'saida' },
      ],
      ramos: [],
    },
  ],
}
