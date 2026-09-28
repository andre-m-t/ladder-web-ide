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
  versao: 2,
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
  versao: 2,
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
 * `io_espelho_8.st` (fixture de bancada, revisão aditiva 2026-09-21):
 * espelha os 16 pinos localizados de uma vez — `saidaN := entradaN` para
 * n = 0..7, um degrau por par, contato NA na coluna 0 e bobina na coluna
 * `COLUNA_TERMINAL`, como `IO_ESPELHO` repetido oito vezes.
 *
 * Motivo: `ENTRADAS_LOCALIZADAS`/`SAIDAS_LOCALIZADAS` (`enderecos.ts`) têm
 * 8 pinos cada desde a revisão 2026-09-17 da pinagem, mas nenhuma fixture de
 * referência até aqui exercitava além de `%IX0.0`/`%IX0.1` e
 * `%QX0.0`/`%QX0.1` — os doze pinos restantes nunca foram gravados nem
 * medidos em hardware físico (ver
 * `docs/validacao/limites-da-validacao-sem-hardware.md`). Esta fixture dá ao
 * passo "entradas e saídas contra tabela-verdade" do Dia do Hardware um
 * programa de referência que toca os 16 pinos, com gabarito medido (não
 * escrito à mão) em `backend/tests/diferencial/fixtures/serializador/
 * io_espelho_8.toml`.
 */
export const IO_ESPELHO_8: Diagrama = {
  versao: 2,
  variaveis: [
    { nome: 'entrada0', tipo: 'BOOL', endereco: '%IX0.0' },
    { nome: 'entrada1', tipo: 'BOOL', endereco: '%IX0.1' },
    { nome: 'entrada2', tipo: 'BOOL', endereco: '%IX0.2' },
    { nome: 'entrada3', tipo: 'BOOL', endereco: '%IX0.3' },
    { nome: 'entrada4', tipo: 'BOOL', endereco: '%IX0.4' },
    { nome: 'entrada5', tipo: 'BOOL', endereco: '%IX0.5' },
    { nome: 'entrada6', tipo: 'BOOL', endereco: '%IX0.6' },
    { nome: 'entrada7', tipo: 'BOOL', endereco: '%IX0.7' },
    { nome: 'saida0', tipo: 'BOOL', endereco: '%QX0.0' },
    { nome: 'saida1', tipo: 'BOOL', endereco: '%QX0.1' },
    { nome: 'saida2', tipo: 'BOOL', endereco: '%QX0.2' },
    { nome: 'saida3', tipo: 'BOOL', endereco: '%QX0.3' },
    { nome: 'saida4', tipo: 'BOOL', endereco: '%QX0.4' },
    { nome: 'saida5', tipo: 'BOOL', endereco: '%QX0.5' },
    { nome: 'saida6', tipo: 'BOOL', endereco: '%QX0.6' },
    { nome: 'saida7', tipo: 'BOOL', endereco: '%QX0.7' },
  ],
  rungs: [
    {
      id: 'r1',
      elementos: [
        { id: 'e1', tipo: 'contato_na', celula: { linha: 0, coluna: 0 }, variavel: 'entrada0' },
        { id: 'e2', tipo: 'bobina', celula: { linha: 0, coluna: COLUNA_TERMINAL }, variavel: 'saida0' },
      ],
      ramos: [],
    },
    {
      id: 'r2',
      elementos: [
        { id: 'e3', tipo: 'contato_na', celula: { linha: 0, coluna: 0 }, variavel: 'entrada1' },
        { id: 'e4', tipo: 'bobina', celula: { linha: 0, coluna: COLUNA_TERMINAL }, variavel: 'saida1' },
      ],
      ramos: [],
    },
    {
      id: 'r3',
      elementos: [
        { id: 'e5', tipo: 'contato_na', celula: { linha: 0, coluna: 0 }, variavel: 'entrada2' },
        { id: 'e6', tipo: 'bobina', celula: { linha: 0, coluna: COLUNA_TERMINAL }, variavel: 'saida2' },
      ],
      ramos: [],
    },
    {
      id: 'r4',
      elementos: [
        { id: 'e7', tipo: 'contato_na', celula: { linha: 0, coluna: 0 }, variavel: 'entrada3' },
        { id: 'e8', tipo: 'bobina', celula: { linha: 0, coluna: COLUNA_TERMINAL }, variavel: 'saida3' },
      ],
      ramos: [],
    },
    {
      id: 'r5',
      elementos: [
        { id: 'e9', tipo: 'contato_na', celula: { linha: 0, coluna: 0 }, variavel: 'entrada4' },
        { id: 'e10', tipo: 'bobina', celula: { linha: 0, coluna: COLUNA_TERMINAL }, variavel: 'saida4' },
      ],
      ramos: [],
    },
    {
      id: 'r6',
      elementos: [
        { id: 'e11', tipo: 'contato_na', celula: { linha: 0, coluna: 0 }, variavel: 'entrada5' },
        { id: 'e12', tipo: 'bobina', celula: { linha: 0, coluna: COLUNA_TERMINAL }, variavel: 'saida5' },
      ],
      ramos: [],
    },
    {
      id: 'r7',
      elementos: [
        { id: 'e13', tipo: 'contato_na', celula: { linha: 0, coluna: 0 }, variavel: 'entrada6' },
        { id: 'e14', tipo: 'bobina', celula: { linha: 0, coluna: COLUNA_TERMINAL }, variavel: 'saida6' },
      ],
      ramos: [],
    },
    {
      id: 'r8',
      elementos: [
        { id: 'e15', tipo: 'contato_na', celula: { linha: 0, coluna: 0 }, variavel: 'entrada7' },
        { id: 'e16', tipo: 'bobina', celula: { linha: 0, coluna: COLUNA_TERMINAL }, variavel: 'saida7' },
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
  versao: 2,
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
  versao: 2,
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
  versao: 2,
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

/**
 * `blink.st` com contador crescente (revisão aditiva da spec 003, tarefa #17
 * revista): reproduz a "variante K" do spike
 * `spikes/modelo/preset25/variante_k_pv12_ctu_antes_iniFALSE_led_atrasado.st`
 * (ver `RESULTADO.md` no mesmo diretório) — a única variante do modelo com
 * `CTU` que fecha em **0 divergências** contra o `blink.st` real (spec 001)
 * nos três padrões de entrada, 200 ciclos, medido com
 * `diferencial.comparador.comparar_execucoes`. `blink_ladder.st` escrito à
 * mão NÃO foi criado: `serializador.dourados.test.ts` grava o `.st` real que
 * `serializar` produz a partir deste diagrama, e
 * `test_serializador_diferencial.py` MEDE a equivalência com o `blink.st` de
 * referência em vez de assumi-la — isso quita a ressalva R-1 do plano 002
 * também para este cenário com contador.
 *
 * Oito degraus (diagrama ASCII do `RESULTADO.md`):
 *
 *   R1 |--[ pulso ]---------+--[CTU ctu0 PV=12]--( atingiu )
 *      |--[ reset_ctu ]-----+   (CU no 1º caminho, R no 2º, linhaControle=1)
 *   R2 |--[ atingiu ]------------------------(R pulso )
 *   R3 |--[/ pulso ]-------------------------( pulso )
 *   R4 |--[ led ]----------------------------( led_estava_aceso )
 *   R5 |--[ reset_ctu ]--[/ led_estava_aceso ]--(S led )
 *   R6 |--[ reset_ctu ]--[ led_estava_aceso ]---(R led )
 *   R7 |--[ atingiu ]------------------------( reset_ctu )
 *   R8 |--[ botao ]--------------------------(S led )
 *
 * `botao` (%IX0.0) e `led` (%QX0.0) espelham `blink.st`; `pulso`,
 * `reset_ctu`, `atingiu` e `led_estava_aceso` são internas, como na variante
 * K (nenhuma delas tem valor inicial — o modelo não expõe esse campo, e a
 * variante K não depende de um).
 */
export const BLINK: Diagrama = {
  versao: 2,
  variaveis: [
    { nome: 'botao', tipo: 'BOOL', endereco: '%IX0.0' },
    { nome: 'led', tipo: 'BOOL', endereco: '%QX0.0' },
    { nome: 'pulso', tipo: 'BOOL' },
    { nome: 'reset_ctu', tipo: 'BOOL' },
    { nome: 'atingiu', tipo: 'BOOL' },
    { nome: 'led_estava_aceso', tipo: 'BOOL' },
  ],
  rungs: [
    {
      // R1: CTU -- CU = pulso (trilho, linha 0), R = reset_ctu (linhaControle 1, sem ramo).
      id: 'r1',
      elementos: [
        { id: 'e1', tipo: 'contato_na', celula: { linha: 0, coluna: 0 }, variavel: 'pulso' },
        { id: 'e2', tipo: 'contato_na', celula: { linha: 1, coluna: 0 }, variavel: 'reset_ctu' },
        {
          id: 'e3',
          tipo: 'ctu',
          celula: { linha: 0, coluna: COLUNA_TERMINAL },
          linhaControle: 1,
          instancia: 'ctu0',
          preset: 12,
          saida: 'atingiu',
        },
      ],
      ramos: [],
    },
    {
      // R2: atingiu -> RESET pulso.
      id: 'r2',
      elementos: [
        { id: 'e4', tipo: 'contato_na', celula: { linha: 0, coluna: 0 }, variavel: 'atingiu' },
        { id: 'e5', tipo: 'bobina_reset', celula: { linha: 0, coluna: COLUNA_TERMINAL }, variavel: 'pulso' },
      ],
      ramos: [],
    },
    {
      // R3: NOT pulso -> pulso (toggle).
      id: 'r3',
      elementos: [
        { id: 'e6', tipo: 'contato_nf', celula: { linha: 0, coluna: 0 }, variavel: 'pulso' },
        { id: 'e7', tipo: 'bobina', celula: { linha: 0, coluna: COLUNA_TERMINAL }, variavel: 'pulso' },
      ],
      ramos: [],
    },
    {
      // R4: led -> led_estava_aceso (instantaneo antes do SET/RESET de led).
      id: 'r4',
      elementos: [
        { id: 'e8', tipo: 'contato_na', celula: { linha: 0, coluna: 0 }, variavel: 'led' },
        { id: 'e9', tipo: 'bobina', celula: { linha: 0, coluna: COLUNA_TERMINAL }, variavel: 'led_estava_aceso' },
      ],
      ramos: [],
    },
    {
      // R5: reset_ctu AND NOT led_estava_aceso -> SET led.
      id: 'r5',
      elementos: [
        { id: 'e10', tipo: 'contato_na', celula: { linha: 0, coluna: 0 }, variavel: 'reset_ctu' },
        { id: 'e11', tipo: 'contato_nf', celula: { linha: 0, coluna: 1 }, variavel: 'led_estava_aceso' },
        { id: 'e12', tipo: 'bobina_set', celula: { linha: 0, coluna: COLUNA_TERMINAL }, variavel: 'led' },
      ],
      ramos: [],
    },
    {
      // R6: reset_ctu AND led_estava_aceso -> RESET led.
      id: 'r6',
      elementos: [
        { id: 'e13', tipo: 'contato_na', celula: { linha: 0, coluna: 0 }, variavel: 'reset_ctu' },
        { id: 'e14', tipo: 'contato_na', celula: { linha: 0, coluna: 1 }, variavel: 'led_estava_aceso' },
        { id: 'e15', tipo: 'bobina_reset', celula: { linha: 0, coluna: COLUNA_TERMINAL }, variavel: 'led' },
      ],
      ramos: [],
    },
    {
      // R7: atingiu -> reset_ctu (o "limite atrasado 1 ciclo" que fecha a variante K).
      id: 'r7',
      elementos: [
        { id: 'e16', tipo: 'contato_na', celula: { linha: 0, coluna: 0 }, variavel: 'atingiu' },
        { id: 'e17', tipo: 'bobina', celula: { linha: 0, coluna: COLUNA_TERMINAL }, variavel: 'reset_ctu' },
      ],
      ramos: [],
    },
    {
      // R8: botao -> SET led.
      id: 'r8',
      elementos: [
        { id: 'e18', tipo: 'contato_na', celula: { linha: 0, coluna: 0 }, variavel: 'botao' },
        { id: 'e19', tipo: 'bobina_set', celula: { linha: 0, coluna: COLUNA_TERMINAL }, variavel: 'led' },
      ],
      ramos: [],
    },
  ],
}

/**
 * `portao.st` (spec 005): lógica mínima do cenário portão — Abrir aciona motor
 * sobe e Fechar aciona motor desce. O botão Parar da planta é NF (revisão
 * 2026-09-28): `%IX0.2` fica verdadeiro em repouso e cai quando o botão é
 * pressionado, então o intertravamento no diagrama é um contato NA.
 * Medido no arcabouço diferencial (RF-11).
 *
 * Revisão 2026-09-23 (spec 005, §10): o FC superior (`fc_superior`) é NA,
 * mas fica **ligado** enquanto a folha estiver fechada ou entreaberta — a
 * lona ainda passa pelo ponto fixo do sensor junto ao tambor — e só
 * **desliga** perto do totalmente aberto. É o inverso do FC inferior (que
 * liga perto do fechado). Por isso `fc_superior` entra em NA onde antes
 * entrava em NF, e vice-versa, em cada degrau abaixo — a intenção de cada
 * degrau (parar o motor no batente, acender a lâmpada certa) não muda, só o
 * tipo de contato que lê `fc_superior` corretamente:
 * - degrau 1: sobe **enquanto não estiver no batente de cima** — antes lia
 *   "não `fc_superior`" (NF), agora lê **`fc_superior` (NA)**, porque
 *   "não estar no batente" passou a ser exatamente quando o sensor está
 *   ligado (lona ainda passando);
 * - degrau 3 (`lamp_aberto`): antes acendia com `fc_superior` (NA) — "sensor
 *   ligado = aberto", que era a leitura simétrica errada. Agora acende com
 *   **`NOT fc_superior`** (NF): aberto é exatamente quando o sensor
 *   *desliga*;
 * - degrau 5 (`lamp_entreaberto`): antes exigia os dois fins de curso
 *   desligados (`NF` para os dois). Agora, como "entreaberto" é quando o
 *   FC superior está **ligado** (lona ainda passa) e o FC inferior está
 *   **desligado** (não chegou ao fundo), o contato de `fc_superior` vira
 *   **NA**, mantendo o de `fc_inferior` em NF.
 */
export const PORTAO: Diagrama = {
  versao: 2,
  variaveis: [
    { nome: 'abrir', tipo: 'BOOL', endereco: '%IX0.0' },
    { nome: 'fechar', tipo: 'BOOL', endereco: '%IX0.1' },
    { nome: 'parar', tipo: 'BOOL', endereco: '%IX0.2' },
    { nome: 'fc_superior', tipo: 'BOOL', endereco: '%IX0.3' },
    { nome: 'fc_inferior', tipo: 'BOOL', endereco: '%IX0.4' },
    { nome: 'motor_sobe', tipo: 'BOOL', endereco: '%QX0.0' },
    { nome: 'motor_desce', tipo: 'BOOL', endereco: '%QX0.1' },
    { nome: 'lamp_entreaberto', tipo: 'BOOL', endereco: '%QX0.2' },
    { nome: 'lamp_aberto', tipo: 'BOOL', endereco: '%QX0.3' },
    { nome: 'lamp_fechado', tipo: 'BOOL', endereco: '%QX0.4' },
  ],
  rungs: [
    {
      id: 'r1',
      elementos: [
        { id: 'e1', tipo: 'contato_na', celula: { linha: 0, coluna: 0 }, variavel: 'abrir' },
        { id: 'e2', tipo: 'contato_na', celula: { linha: 0, coluna: 1 }, variavel: 'parar' },
        { id: 'e3', tipo: 'contato_na', celula: { linha: 0, coluna: 2 }, variavel: 'fc_superior' },
        { id: 'e4', tipo: 'bobina', celula: { linha: 0, coluna: COLUNA_TERMINAL }, variavel: 'motor_sobe' },
      ],
      ramos: [],
    },
    {
      id: 'r2',
      elementos: [
        { id: 'e5', tipo: 'contato_na', celula: { linha: 0, coluna: 0 }, variavel: 'fechar' },
        { id: 'e6', tipo: 'contato_na', celula: { linha: 0, coluna: 1 }, variavel: 'parar' },
        { id: 'e7', tipo: 'contato_nf', celula: { linha: 0, coluna: 2 }, variavel: 'fc_inferior' },
        { id: 'e8', tipo: 'bobina', celula: { linha: 0, coluna: COLUNA_TERMINAL }, variavel: 'motor_desce' },
      ],
      ramos: [],
    },
    {
      id: 'r3',
      elementos: [
        { id: 'e9', tipo: 'contato_nf', celula: { linha: 0, coluna: 0 }, variavel: 'fc_superior' },
        { id: 'e10', tipo: 'bobina', celula: { linha: 0, coluna: COLUNA_TERMINAL }, variavel: 'lamp_aberto' },
      ],
      ramos: [],
    },
    {
      id: 'r4',
      elementos: [
        { id: 'e11', tipo: 'contato_na', celula: { linha: 0, coluna: 0 }, variavel: 'fc_inferior' },
        { id: 'e12', tipo: 'bobina', celula: { linha: 0, coluna: COLUNA_TERMINAL }, variavel: 'lamp_fechado' },
      ],
      ramos: [],
    },
    {
      id: 'r5',
      elementos: [
        { id: 'e13', tipo: 'contato_na', celula: { linha: 0, coluna: 0 }, variavel: 'fc_superior' },
        { id: 'e14', tipo: 'contato_nf', celula: { linha: 0, coluna: 1 }, variavel: 'fc_inferior' },
        { id: 'e15', tipo: 'bobina', celula: { linha: 0, coluna: COLUNA_TERMINAL }, variavel: 'lamp_entreaberto' },
      ],
      ramos: [],
    },
  ],
}

/** `saidas_paralelas.st`: uma condição aciona duas bobinas no mesmo degrau (revisão 2026-09-22). */
export const SAIDAS_PARALELAS: Diagrama = {
  versao: 2,
  variaveis: [
    { nome: 'entrada', tipo: 'BOOL', endereco: '%IX0.0' },
    { nome: 'saida_a', tipo: 'BOOL', endereco: '%QX0.0' },
    { nome: 'saida_b', tipo: 'BOOL', endereco: '%QX0.1' },
  ],
  rungs: [
    {
      id: 'r1',
      elementos: [
        { id: 'e1', tipo: 'contato_na', celula: { linha: 0, coluna: 0 }, variavel: 'entrada' },
        { id: 'e2', tipo: 'bobina', celula: { linha: 0, coluna: COLUNA_TERMINAL }, variavel: 'saida_a' },
        { id: 'e3', tipo: 'bobina', celula: { linha: 1, coluna: COLUNA_TERMINAL }, variavel: 'saida_b' },
      ],
      ramos: [{ id: 'b1', linha: 1, colunaInicio: COLUNA_TERMINAL, colunaFim: COLUNA_TERMINAL }],
    },
  ],
}

/** TON mínimo: entrada `gate`, PT=100ms (5 ciclos), saída `atraso`. */
export const TON_ATRASO: Diagrama = {
  versao: 2,
  variaveis: [
    { nome: 'gate', tipo: 'BOOL', endereco: '%IX0.0' },
    { nome: 'atraso', tipo: 'BOOL', endereco: '%QX0.0' },
  ],
  rungs: [
    {
      id: 'r1',
      elementos: [
        { id: 'e1', tipo: 'contato_na', celula: { linha: 0, coluna: 0 }, variavel: 'gate' },
        {
          id: 'e2',
          tipo: 'ton',
          celula: { linha: 0, coluna: COLUNA_TERMINAL },
          linhaControle: null,
          instancia: 'ton0',
          preset: 100,
          saida: 'atraso',
        },
      ],
      ramos: [],
    },
  ],
}

/** TOF mínimo: mantém `saida` após `gate` cair, PT=100ms. */
export const TOF_RETARDO: Diagrama = {
  versao: 2,
  variaveis: [
    { nome: 'gate', tipo: 'BOOL', endereco: '%IX0.0' },
    { nome: 'saida', tipo: 'BOOL', endereco: '%QX0.0' },
  ],
  rungs: [
    {
      id: 'r1',
      elementos: [
        { id: 'e1', tipo: 'contato_na', celula: { linha: 0, coluna: 0 }, variavel: 'gate' },
        {
          id: 'e2',
          tipo: 'tof',
          celula: { linha: 0, coluna: COLUNA_TERMINAL },
          linhaControle: null,
          instancia: 'tof0',
          preset: 100,
          saida: 'saida',
        },
      ],
      ramos: [],
    },
  ],
}

/** CTD mínimo: CD=`pulso`, LD=`carregar`, PV=3, saída `vazio`. */
export const CTD_DESCE: Diagrama = {
  versao: 2,
  variaveis: [
    { nome: 'pulso', tipo: 'BOOL', endereco: '%IX0.0' },
    { nome: 'carregar', tipo: 'BOOL', endereco: '%IX0.1' },
    { nome: 'vazio', tipo: 'BOOL', endereco: '%QX0.0' },
  ],
  rungs: [
    {
      id: 'r1',
      elementos: [
        { id: 'e1', tipo: 'contato_na', celula: { linha: 0, coluna: 0 }, variavel: 'pulso' },
        { id: 'e2', tipo: 'contato_na', celula: { linha: 1, coluna: 0 }, variavel: 'carregar' },
        {
          id: 'e3',
          tipo: 'ctd',
          celula: { linha: 0, coluna: COLUNA_TERMINAL },
          linhaControle: 1,
          instancia: 'ctd0',
          preset: 3,
          saida: 'vazio',
        },
      ],
      ramos: [],
    },
  ],
}
