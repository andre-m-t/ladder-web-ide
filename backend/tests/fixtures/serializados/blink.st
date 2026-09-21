(* Gerado pelo LadderFlow a partir de um diagrama Ladder. Nao editar. *)
PROGRAM prog0
  VAR
    botao AT %IX0.0 : BOOL;
    led AT %QX0.0 : BOOL;
  END_VAR
  VAR
    pulso : BOOL;
    reset_ctu : BOOL;
    atingiu : BOOL;
    led_estava_aceso : BOOL;
    ctu0 : CTU;
  END_VAR

  (* degrau 1 *)
  ctu0(CU := pulso, R := reset_ctu, PV := 12);
  atingiu := ctu0.Q;
  (* degrau 2 *)
  IF atingiu THEN
    pulso := FALSE;
  END_IF;
  (* degrau 3 *)
  pulso := NOT pulso;
  (* degrau 4 *)
  led_estava_aceso := led;
  (* degrau 5 *)
  IF reset_ctu AND NOT led_estava_aceso THEN
    led := TRUE;
  END_IF;
  (* degrau 6 *)
  IF reset_ctu AND led_estava_aceso THEN
    led := FALSE;
  END_IF;
  (* degrau 7 *)
  reset_ctu := atingiu;
  (* degrau 8 *)
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
