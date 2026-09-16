(* Variante E -- PV=13, mesmo contador da variante A, mas o `led` alterna
   por um UNICO rung combinacional (ramo paralelo), nao por par SET/RESET.
   Testa a celula da matriz "toggle por ramo paralelo com bobina simples:
   led := (atingiu AND NOT led) OR (NOT atingiu AND led)".

   Motivo de interesse independente da fase: este desenho substitui os
   rungs 4/5/6 da variante A (instantaneo + par SET/RESET) por 1 rung so,
   eliminando de saida o risco de auto-cancelamento no mesmo scan descrito
   em NOTAS.md (nao ha dois rungs escrevendo o mesmo bit no mesmo scan) --
   `led_estava_aceso` deixa de ser necessario. Verifica-se aqui se isso muda
   a contagem/posicao das divergencias de fase (nao deveria: e uma troca de
   MECANISMO de toggle, nao do periodo do CTU).

   Ladder (ASCII):

   Rung 1 (pulso):
   ====|/pulso|==================( pulso )====

   Rung 2 (contador, igual a variante A):
   ====|pulso|===+==[ CTU PV=13 ]===saida=atingiu====
                 %
                 +--|reset_ctu|--+

   Rung 3 (agenda reset, igual a variante A):
   ====|atingiu|=================( reset_ctu )====

   Rung 4 (toggle combinacional -- DOIS caminhos em paralelo que se juntam
           na mesma bobina `led`; nenhum SET/RESET):
   ====|atingiu|==|/led|====+==================( led )====
   ====|/atingiu|==|led|====+

   Rung 5 (botao, igual a variante A):
   ====|botao|====================(S led )====

   ST derivado (a bobina comum de um rung com ramo paralelo e o OU dos
   caminhos serie -- aqui exatamente a expressao do enunciado):
     pulso := NOT pulso;
     ctu0(CU := pulso, R := reset_ctu, PV := 13);
     atingiu := ctu0.Q;
     reset_ctu := atingiu;
     led := (atingiu AND NOT led) OR (NOT atingiu AND led);
     IF botao THEN led := TRUE; END_IF; *)

PROGRAM prog0
  VAR
    botao AT %IX0.0 : BOOL;
    led   AT %QX0.0 : BOOL;
  END_VAR
  VAR
    pulso     : BOOL;
    reset_ctu : BOOL;
    atingiu   : BOOL;
    ctu0      : CTU;
  END_VAR

  (* Rung 1 *)
  pulso := NOT pulso;

  (* Rung 2 *)
  ctu0(CU := pulso, R := reset_ctu, PV := 13);
  atingiu := ctu0.Q;

  (* Rung 3 *)
  reset_ctu := atingiu;

  (* Rung 4 -- toggle por ramo paralelo, sem SET/RESET *)
  led := (atingiu AND NOT led) OR (NOT atingiu AND led);

  (* Rung 5 *)
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
