(* Variante F -- PV=13, mesmo desenho da variante A, so muda o valor
   INICIAL de `pulso` para TRUE em vez do default FALSE. Testa a celula da
   matriz "pulso inicial FALSE/TRUE".

   ACHADO A REGISTRAR (ver RESULTADO.md): o modelo grafico obrigatorio
   (spikes/modelo/modelo.ts, interface `Variavel`) NAO tem campo de valor
   inicial -- so `nome`, `tipo`, `endereco?`. Esta variante e expressavel em
   ST puro (`pulso : BOOL := TRUE;`, sintaxe valida de IEC 61131-3), mas NAO
   e desenhavel com o modelo de dados da grade tal como ele existe hoje: um
   editor Ladder que use esse modelo nao tem como o autor do diagrama pedir
   "essa variavel comeca em TRUE". Se esta variante fosse a vencedora,
   `Variavel` precisaria ganhar um campo tipo `valorInicial?: boolean` (so
   faz sentido para BOOL nao localizado; UINT e localizado ficam fora). Ela
   NAO e a vencedora (ver RESULTADO.md), entao o gap fica soh registrado,
   sem exigir mudanca no modelo.

   Ladder: identico a variante A (nao ha elemento grafico que represente
   "valor inicial"; a diferenca so aparece no ST). *)

PROGRAM prog0
  VAR
    botao AT %IX0.0 : BOOL;
    led   AT %QX0.0 : BOOL;
  END_VAR
  VAR
    pulso            : BOOL := TRUE; (* unica diferenca frente a variante A *)
    reset_ctu        : BOOL;
    atingiu          : BOOL;
    led_estava_aceso : BOOL;
    ctu0             : CTU;
  END_VAR

  (* Rung 1 *)
  pulso := NOT pulso;

  (* Rung 2 *)
  ctu0(CU := pulso, R := reset_ctu, PV := 13);
  atingiu := ctu0.Q;

  (* Rung 3 *)
  reset_ctu := atingiu;

  (* Rung 4 *)
  led_estava_aceso := led;

  (* Rung 5 *)
  IF atingiu AND NOT led_estava_aceso THEN
    led := TRUE;
  END_IF;

  (* Rung 6 *)
  IF atingiu AND led_estava_aceso THEN
    led := FALSE;
  END_IF;

  (* Rung 7 *)
  IF botao THEN
    led := TRUE;
  END_IF;
END_PROGRAM

CONFIGURATION Config0
  RESOURCE Res0 ON PLC
    TASK task0(INTERVAL := T#20ms, PRIORITY := 0);
    PROGRAM instance0 WITH task0 : prog0;
  END_RESOURCE
END_CONFIGURATION
