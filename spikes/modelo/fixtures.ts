// Tres diagramas de referencia, no modelo de spikes/modelo/modelo.ts.
//
// Espelham os tres `.st` de backend/tests/fixtures/ (MINIMAL, IO_ESPELHO) e o
// gabarito diferencial de backend/tests/diferencial/fixtures/blink.toml
// (BLINK) -- ver NOTAS.md para o Ladder de cada um em ASCII e para o
// experimento de equivalencia do BLINK.

import type { Diagrama } from './modelo'

// -- MINIMAL -----------------------------------------------------------
// Espelha backend/tests/fixtures/minimal.st: `saida := NOT entrada;`
// Nenhuma das duas variaveis e localizada (sem `AT %..`) no .st original --
// o modelo reflete isso deixando `endereco` de fora.

export const MINIMAL: Diagrama = {
  versao: 1,
  variaveis: [
    { nome: 'entrada', tipo: 'BOOL' },
    { nome: 'saida', tipo: 'BOOL' },
  ],
  rungs: [
    {
      id: 'rung_minimal_1',
      colunas: 2,
      elementos: [
        { id: 'el_1', tipo: 'contato_nf', celula: { linha: 0, coluna: 0 }, variavel: 'entrada' },
        { id: 'el_2', tipo: 'bobina', celula: { linha: 0, coluna: 1 }, variavel: 'saida' },
      ],
      ramos: [],
    },
  ],
}

// -- IO_ESPELHO ----------------------------------------------------------
// Espelha backend/tests/fixtures/io_espelho.st: `saida := entrada;`, com
// `entrada AT %IX0.1` e `saida AT %QX0.1` (pinagem Q-5).

export const IO_ESPELHO: Diagrama = {
  versao: 1,
  variaveis: [
    { nome: 'entrada', tipo: 'BOOL', endereco: '%IX0.1' },
    { nome: 'saida', tipo: 'BOOL', endereco: '%QX0.1' },
  ],
  rungs: [
    {
      id: 'rung_io_espelho_1',
      colunas: 2,
      elementos: [
        { id: 'el_1', tipo: 'contato_na', celula: { linha: 0, coluna: 0 }, variavel: 'entrada' },
        { id: 'el_2', tipo: 'bobina', celula: { linha: 0, coluna: 1 }, variavel: 'saida' },
      ],
      ramos: [],
    },
  ],
}

// -- BLINK -----------------------------------------------------------------
// O Ladder do risco principal do spike (ver NOTAS.md, "Experimento BLINK").
// Nao e uma traducao direta de backend/tests/fixtures/blink.st -- e um
// desenho alternativo, escrito para exercitar contato NA/NF, ramo paralelo,
// bobina SET/RESET e CTU ao mesmo tempo, cujo ST equivalente (escrito a mao
// em blink_ladder.st) e comparado ciclo a ciclo contra o gabarito de
// backend/tests/diferencial/fixtures/blink.toml.
//
// Variaveis internas (sem endereco): `pulso` (oscilador de 1 scan, ve rung
// 1), `atingiu` (espelha `ctu0.Q` como variavel comum -- ver NOTAS.md sobre
// por que o elemento `ctu` nao dispensa isso), `reset_ctu` (realimentacao
// atrasada de 1 scan que zera o CTU -- uma das duas fontes de divergencia
// medida) e `led_estava_aceso` (ve rung 4, "instantaneo de led").
//
// `led_estava_aceso` existe por um bug real encontrado RODANDO o experimento
// (nao antecipado no desenho original): os rungs 5 e 6 (SET/RESET de `led`,
// ambos disparados por `atingiu`) leem `led` ao vivo. Sem o instantaneo, o
// rung 5 liga `led` e o rung 6, avaliado logo em seguida NO MESMO SCAN, ve o
// `led` ja TRUE e desliga de volta -- um auto-cancelamento tipico de scan
// unico. Ver NOTAS.md, "Risco descoberto no experimento", para o relato
// completo.

export const BLINK: Diagrama = {
  versao: 1,
  variaveis: [
    { nome: 'botao', tipo: 'BOOL', endereco: '%IX0.0' },
    { nome: 'led', tipo: 'BOOL', endereco: '%QX0.0' },
    { nome: 'pulso', tipo: 'BOOL' },
    { nome: 'atingiu', tipo: 'BOOL' },
    { nome: 'reset_ctu', tipo: 'BOOL' },
    { nome: 'led_estava_aceso', tipo: 'BOOL' },
  ],
  rungs: [
    // Rung 1 -- oscilador de scan: pulso := NOT pulso.
    {
      id: 'rung_pulso',
      colunas: 2,
      elementos: [
        { id: 'el_pulso_c1', tipo: 'contato_nf', celula: { linha: 0, coluna: 0 }, variavel: 'pulso' },
        { id: 'el_pulso_bob', tipo: 'bobina', celula: { linha: 0, coluna: 1 }, variavel: 'pulso' },
      ],
      ramos: [],
    },
    // Rung 2 -- contador via CTU. `pulso` alimenta CU (contato na linha 0);
    // o ramo paralelo (linha 1) alimenta o pino de reset do CTU com
    // `reset_ctu` -- ilustra o Ramo do modelo, embora o elemento `ctu` desta
    // versao do modelo nao distinga pino a pino (ver NOTAS.md). `saida`
    // escreve o `Q` do CTU na variavel comum `atingiu`.
    {
      id: 'rung_contador',
      colunas: 2,
      elementos: [
        { id: 'el_ctu_c1', tipo: 'contato_na', celula: { linha: 0, coluna: 0 }, variavel: 'pulso' },
        {
          id: 'el_ctu_ramo_c1',
          tipo: 'contato_na',
          celula: { linha: 1, coluna: 0 },
          variavel: 'reset_ctu',
        },
        {
          id: 'el_ctu',
          tipo: 'ctu',
          celula: { linha: 0, coluna: 1 },
          instancia: 'ctu0',
          pv: 13,
          saida: 'atingiu',
        },
      ],
      ramos: [{ id: 'ramo_reset_ctu', linha: 1, colunaInicio: 0, colunaFim: 1 }],
    },
    // Rung 3 -- agenda o reset do CTU um scan depois de Q ligar:
    // reset_ctu := atingiu.
    {
      id: 'rung_reset_ctu',
      colunas: 2,
      elementos: [
        { id: 'el_reset_c1', tipo: 'contato_na', celula: { linha: 0, coluna: 0 }, variavel: 'atingiu' },
        { id: 'el_reset_bob', tipo: 'bobina', celula: { linha: 0, coluna: 1 }, variavel: 'reset_ctu' },
      ],
      ramos: [],
    },
    // Rung 4 -- instantaneo de led ANTES do par SET/RESET (ver NOTAS.md):
    // led_estava_aceso := led. Contato NA(led) sozinho -> bobina; o rung so
    // copia o estado, nao decide nada.
    {
      id: 'rung_snapshot_led',
      colunas: 2,
      elementos: [
        { id: 'el_snap_c1', tipo: 'contato_na', celula: { linha: 0, coluna: 0 }, variavel: 'led' },
        {
          id: 'el_snap_bob',
          tipo: 'bobina',
          celula: { linha: 0, coluna: 1 },
          variavel: 'led_estava_aceso',
        },
      ],
      ramos: [],
    },
    // Rung 5 -- liga led quando o CTU atinge o patamar e led estava apagado:
    // IF atingiu AND NOT led_estava_aceso THEN led := TRUE (SET). O segundo
    // contato le o INSTANTANEO (rung 4), nao `led` ao vivo -- e exatamente
    // essa troca que evita o auto-cancelamento com o rung 6.
    {
      id: 'rung_led_set',
      colunas: 3,
      elementos: [
        { id: 'el_set_c1', tipo: 'contato_na', celula: { linha: 0, coluna: 0 }, variavel: 'atingiu' },
        {
          id: 'el_set_c2',
          tipo: 'contato_nf',
          celula: { linha: 0, coluna: 1 },
          variavel: 'led_estava_aceso',
        },
        { id: 'el_set_bob', tipo: 'bobina_set', celula: { linha: 0, coluna: 2 }, variavel: 'led' },
      ],
      ramos: [],
    },
    // Rung 6 -- desliga led quando o CTU atinge o patamar e led estava aceso:
    // IF atingiu AND led_estava_aceso THEN led := FALSE (RESET). Mesmo
    // instantaneo do rung 5.
    {
      id: 'rung_led_reset',
      colunas: 3,
      elementos: [
        { id: 'el_reset_led_c1', tipo: 'contato_na', celula: { linha: 0, coluna: 0 }, variavel: 'atingiu' },
        {
          id: 'el_reset_led_c2',
          tipo: 'contato_na',
          celula: { linha: 0, coluna: 1 },
          variavel: 'led_estava_aceso',
        },
        {
          id: 'el_reset_led_bob',
          tipo: 'bobina_reset',
          celula: { linha: 0, coluna: 2 },
          variavel: 'led',
        },
      ],
      ramos: [],
    },
    // Rung 7 -- botao forca led aceso, igual a blink.st original.
    // Vem POR ULTIMO, mesma ordem do `IF botao THEN led := TRUE` no .st.
    {
      id: 'rung_botao',
      colunas: 2,
      elementos: [
        { id: 'el_botao_c1', tipo: 'contato_na', celula: { linha: 0, coluna: 0 }, variavel: 'botao' },
        { id: 'el_botao_bob', tipo: 'bobina_set', celula: { linha: 0, coluna: 1 }, variavel: 'led' },
      ],
      ramos: [],
    },
  ],
}
