(* Variante C -- mesmo desenho da variante A, PV=25 (o valor "obvio" -- PV
   igual ao limite de contador.st -- citado no enunciado como tentativa a
   medir). Previsao analitica (RESULTADO.md, prova do periodo minimo
   T=2*PV): com CU alternando 1 vez por ciclo (borda a cada 2 ciclos) e reset
   consumindo 1 ciclo, o periodo minimo entre disparos de `atingiu` e
   2*25=50 ciclos -- 2x mais lento que os 25 ciclos de blink.st, nao um
   candidato melhor que PV=13. Medido aqui para confirmar. *)

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

  (* Rung 1 *)
  pulso := NOT pulso;

  (* Rung 2 -- unica diferenca frente a variante A: PV=25 *)
  ctu0(CU := pulso, R := reset_ctu, PV := 25);
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
