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

/**
 * `ramo_ou.st` (spec 003, tarefa #2): `q := a OR b;`. Contato NA `a` no
 * trilho principal, coluna 0; ramo na linha 1, coluna 0, com contato NA `b`;
 * bobina `q`. Semântica de "ou" clássica de dois contatos em paralelo.
 */
export const RAMO_OU: Diagrama = {
  versao: 1,
  variaveis: [
    { nome: 'a', tipo: 'BOOL', endereco: '%IX0.0' },
    { nome: 'b', tipo: 'BOOL', endereco: '%IX0.1' },
    { nome: 'q', tipo: 'BOOL', endereco: '%QX0.0' },
  ],
  rungs: [
    {
      id: 'r1',
      elementos: [
        { id: 'e1', tipo: 'contato_na', celula: { linha: 0, coluna: 0 }, variavel: 'a' },
        { id: 'e2', tipo: 'contato_na', celula: { linha: 1, coluna: 0 }, variavel: 'b' },
        { id: 'e3', tipo: 'bobina', celula: { linha: 0, coluna: COLUNA_TERMINAL }, variavel: 'q' },
      ],
      ramos: [{ id: 'b1', linha: 1, colunaInicio: 0, colunaFim: 0 }],
    },
  ],
}

/**
 * `set_reset.st` (spec 003, tarefa #2): degrau 1 — NA `liga` aciona
 * `bobina_set q`; degrau 2 — NA `desliga` aciona `bobina_reset q`. Sem
 * autodependência (nenhum contato de `q` nas condições), então
 * `validarDiagrama` não acusa `set_reset_autodependente` aqui.
 */
export const SET_RESET: Diagrama = {
  versao: 1,
  variaveis: [
    { nome: 'liga', tipo: 'BOOL', endereco: '%IX0.0' },
    { nome: 'desliga', tipo: 'BOOL', endereco: '%IX0.1' },
    { nome: 'q', tipo: 'BOOL', endereco: '%QX0.0' },
  ],
  rungs: [
    {
      id: 'r1',
      elementos: [
        { id: 'e1', tipo: 'contato_na', celula: { linha: 0, coluna: 0 }, variavel: 'liga' },
        { id: 'e2', tipo: 'bobina_set', celula: { linha: 0, coluna: COLUNA_TERMINAL }, variavel: 'q' },
      ],
      ramos: [],
    },
    {
      id: 'r2',
      elementos: [
        { id: 'e3', tipo: 'contato_na', celula: { linha: 0, coluna: 0 }, variavel: 'desliga' },
        { id: 'e4', tipo: 'bobina_reset', celula: { linha: 0, coluna: COLUNA_TERMINAL }, variavel: 'q' },
      ],
      ramos: [],
    },
  ],
}

/**
 * `selo.st` (spec 003, tarefa #2): `motor := (partida OR motor) AND NOT parada;`
 * — o clássico circuito de selo/realimentação. NA `partida` no trilho,
 * coluna 0; ramo na linha 1, coluna 0, com NA `motor` (a própria bobina do
 * degrau, realimentada); NF `parada` na coluna 1; bobina `motor`. Usa bobina
 * simples (não SET/RESET), então não há autodependência de SET/RESET a
 * validar aqui — só o `contato_na` de `motor` realimentando o próprio
 * degrau, que `validarDiagrama` aceita sem problema.
 */
export const SELO: Diagrama = {
  versao: 1,
  variaveis: [
    { nome: 'partida', tipo: 'BOOL', endereco: '%IX0.0' },
    { nome: 'parada', tipo: 'BOOL', endereco: '%IX0.1' },
    { nome: 'motor', tipo: 'BOOL', endereco: '%QX0.0' },
  ],
  rungs: [
    {
      id: 'r1',
      elementos: [
        { id: 'e1', tipo: 'contato_na', celula: { linha: 0, coluna: 0 }, variavel: 'partida' },
        { id: 'e2', tipo: 'contato_na', celula: { linha: 1, coluna: 0 }, variavel: 'motor' },
        { id: 'e3', tipo: 'contato_nf', celula: { linha: 0, coluna: 1 }, variavel: 'parada' },
        { id: 'e4', tipo: 'bobina', celula: { linha: 0, coluna: COLUNA_TERMINAL }, variavel: 'motor' },
      ],
      ramos: [{ id: 'b1', linha: 1, colunaInicio: 0, colunaFim: 0 }],
    },
  ],
}
