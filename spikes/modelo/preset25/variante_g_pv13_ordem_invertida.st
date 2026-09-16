(* Variante G -- PV=13, mesmo desenho da variante A, mas o rung do CTU vem
   ANTES do rung que alterna `pulso` (ordem de leitura trocada). Testa a
   celula da matriz "rung de pulso antes/depois do rung do CTU".

   Com essa troca, o `CU` que o CTU le no scan N e o `pulso` como ficou no
   FIM do scan N-1 (o toggle deste scan so acontece DEPOIS, no rung
   seguinte) -- desloca a fase de leitura de `pulso` em 1 scan frente a
   variante A, analogo ao que um valor inicial diferente faria, mas via
   ordem de rung em vez de valor inicial (essa SIM e desenhavel no modelo
   grafico hoje: e so por o rung do contador antes do rung do oscilador na
   lista `rungs` do `Diagrama` -- nao exige nenhum campo novo).

   Ladder (ASCII; ordem trocada frente a variante A):

   Rung 1 (contador, agora primeiro):
   ====|pulso|===+==[ CTU PV=13 ]===saida=atingiu====
                 %
                 +--|reset_ctu|--+

   Rung 2 (pulso, agora depois):
   ====|/pulso|==================( pulso )====

   Rung 3 (agenda reset):
   ====|atingiu|=================( reset_ctu )====

   Rung 4 (instantaneo de led):
   ====|led|======================( led_estava_aceso )====

   Rung 5 (liga led):
   ====|atingiu|==|/led_estava_aceso|========(S led )====

   Rung 6 (desliga led):
   ====|atingiu|==|led_estava_aceso|=========(R led )====

   Rung 7 (botao):
   ====|botao|====================(S led )====

   ST derivado (so a ordem das duas primeiras atribuicoes muda frente a
   variante A):
     ctu0(CU := pulso, R := reset_ctu, PV := 13);
     atingiu := ctu0.Q;
     pulso := NOT pulso;
     reset_ctu := atingiu;
     led_estava_aceso := led;
     IF atingiu AND NOT led_estava_aceso THEN led := TRUE; END_IF;
     IF atingiu AND led_estava_aceso THEN led := FALSE; END_IF;
     IF botao THEN led := TRUE; END_IF; *)

PROGRAM prog0
  VAR
    botao AT %IX0.0 : BOOL;
    led   AT %QX0.0 : BOOL;
  END_VAR
  VAR
    pulso            : BOOL;
    reset_ctu        : BOOL;
    atingiu          : BOOL;
    led_estava_aceso : BOOL;
    ctu0             : CTU;
  END_VAR

  (* Rung 1 -- contador, ANTES do toggle de pulso (ordem trocada) *)
  ctu0(CU := pulso, R := reset_ctu, PV := 13);
  atingiu := ctu0.Q;

  (* Rung 2 -- pulso, agora depois *)
  pulso := NOT pulso;

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
