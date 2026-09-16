(* Variante B -- mesmo desenho da variante A, PV=12 em vez de 13 (mesma
   tentativa "PV diferente" ja medida em spikes/modelo/blink_ladder_pv12.st,
   reproduzida aqui para entrar na mesma bateria de medicao de 200 ciclos /
   3 padroes de %IX0.0 do preset25). Ver RESULTADO.md.

   Ladder identico ao da variante A (variante_a_pv13_base.st), so troca
   PV:=13 por PV:=12 no rung 2. ST derivado idem, com PV:=12. *)

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

  (* Rung 2 -- unica diferenca frente a variante A: PV=12 *)
  ctu0(CU := pulso, R := reset_ctu, PV := 12);
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
